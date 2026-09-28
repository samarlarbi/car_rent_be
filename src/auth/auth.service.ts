import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const userCount = await this.usersRepository.count();
    const isFirstUser = userCount === 0;

    // Whatever role was requested, the very first account on the system
    // still needs to bootstrap as an approved admin -- there is nobody else
    // who could approve them.
    const requestedRole = registerDto.requestedRole === 'admin' ? 'admin' : 'coworker';

    const user = this.usersRepository.create({
      ...registerDto,
      password: hashedPassword,
      language: registerDto.language || 'en',
      requestedRole,
      // First user becomes approved admin; everyone else waits for approval
      isApproved: isFirstUser,
      isActive: isFirstUser,
      isSuperAdmin: isFirstUser,
    });

    await this.usersRepository.save(user);

    if (!isFirstUser) {
      return {
        message: 'Registration submitted. Waiting for admin approval.',
        pending: true,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          requestedRole: user.requestedRole,
          isApproved: false,
        },
      };
    }

    return this.generateTokens(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isApproved) {
      throw new UnauthorizedException('Your account is pending admin approval');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    user.lastLogin = new Date();
    await this.usersRepository.save(user);

    return this.generateTokens(user);
  }

  async getPendingUsers() {
    const users = await this.usersRepository.find({
      where: { isApproved: false },
      order: { createdAt: 'DESC' },
    });
    return users.map(({ password, refreshToken, ...rest }) => rest);
  }

  /**
   * Approves a pending account. Grants isSuperAdmin based on what the user
   * requested at signup, unless the approving admin explicitly overrides it
   * via `grantAdmin` (e.g. they want to approve someone as a coworker even
   * though the person asked to be an admin, or vice versa).
   */
  async approveUser(userId: string, grantAdmin?: boolean) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    user.isApproved = true;
    user.isActive = true;
    user.isSuperAdmin = grantAdmin !== undefined ? grantAdmin : user.requestedRole === 'admin';
    await this.usersRepository.save(user);
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async rejectUser(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.isApproved) {
      throw new BadRequestException('Cannot reject an already approved user');
    }
    await this.usersRepository.remove(user);
    return { message: 'User registration rejected' };
  }

  /** For an admin-facing user-management/settings page: every approved account. */
  async getAllUsers() {
    const users = await this.usersRepository.find({
      where: { isApproved: true },
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return users.map(({ password, refreshToken, ...rest }) => rest);
  }

  /** Promote/demote an already-approved user. */
  async setUserRole(userId: string, isSuperAdmin: boolean) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    user.isSuperAdmin = isSuperAdmin;
    await this.usersRepository.save(user);
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  /** Suspend/reinstate an account without deleting it. */
  async setUserActive(userId: string, isActive: boolean) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    user.isActive = isActive;
    if (!isActive) {
      // Force re-login everywhere once reinstated, rather than letting a
      // stale refresh token silently keep working.
      user.refreshToken = null;
    }
    await this.usersRepository.save(user);
    const { password, refreshToken, ...rest } = user;
    return rest;
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.usersRepository.update(userId, { refreshToken: null });
    return { message: 'Logged out successfully' };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersRepository.findOne({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }

    return null;
  }

  async validateUserById(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      return null;
    }

    const { password, ...result } = user;
    return result;
  }

  async getProfile(userId: string) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const { password, refreshToken, ...safe } = user;
    return safe;
  }

  async updateLanguage(userId: string, language: string) {
    if (!['en', 'fr', 'ar'].includes(language)) {
      throw new BadRequestException('Invalid language');
    }

    await this.usersRepository.update(userId, { language });
    return { message: 'Language updated successfully' };
  }

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRATION', '7d'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '30d'),
    });

    await this.usersRepository.update(user.id, { refreshToken });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        language: user.language,
        isSuperAdmin: user.isSuperAdmin,
        requestedRole: user.requestedRole,
        isApproved: user.isApproved,
        isActive: user.isActive,
      },
      accessToken,
      refreshToken,
    };
  }
}