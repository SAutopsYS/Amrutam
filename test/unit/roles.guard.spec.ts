import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/modules/rbac/guards/roles.guard';
import { ErrorCode, RoleName } from '../../src/common/constants';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  const createContext = (user?: { roles: string[] }): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(createContext({ roles: ['Patient'] }))).toBe(true);
  });

  it('allows access when required role matches', () => {
    reflector.getAllAndOverride.mockReturnValue([RoleName.PATIENT]);
    expect(guard.canActivate(createContext({ roles: ['Patient'] }))).toBe(true);
  });

  it('denies access when user is missing', () => {
    reflector.getAllAndOverride.mockReturnValue([RoleName.PATIENT]);
    expect(() => guard.canActivate(createContext())).toThrow(ForbiddenException);
  });

  it('denies access when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue([RoleName.DOCTOR]);
    expect(() => guard.canActivate(createContext({ roles: ['Patient'] }))).toThrow(
      expect.objectContaining({ code: ErrorCode.FORBIDDEN }),
    );
  });
});
