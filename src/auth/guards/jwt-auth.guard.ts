import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Temporarily disabled via AUTH_ENABLED=false in .env (defaults to enabled
 * if unset, so forgetting to set it fails safe). When disabled, every route
 * normally guarded by this -- reservations, cars, customers, dashboard,
 * auth's own protected endpoints -- is reachable with no token at all.
 *
 * A placeholder req.user is attached rather than leaving it undefined,
 * since several controllers read req.user.id (e.g. "confirmedBy") and
 * req.user?.isSuperAdmin (the pending-users/admin-only checks) -- without
 * this, every write endpoint would throw instead of just running
 * unauthenticated. isSuperAdmin is set true here so admin-only endpoints
 * (approve/reject, user management) also stay reachable while auth is off,
 * since there's no real admin session to check against anyway.
 *
 * To bring authentication back: set AUTH_ENABLED=true (or remove the var).
 * No other code changes needed -- the guard, routes, and decorators are
 * untouched.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    if (process.env.AUTH_ENABLED === 'false') {
      const req = context.switchToHttp().getRequest();
      req.user = {
        id: 'public-access',
        email: 'public@local',
        isSuperAdmin: true,
      };
      return true;
    }
    return super.canActivate(context);
  }
}