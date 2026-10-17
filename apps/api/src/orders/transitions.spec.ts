import { canTransition, nextStatuses } from '@amprex/shared';

describe('order transitions', () => {
  it('lets only office roles assign and complete', () => {
    expect(canTransition('CREATED', 'ASSIGNED', 'OPERATOR')).toBe(true);
    expect(canTransition('CREATED', 'ASSIGNED', 'TECHNICIAN')).toBe(false);
    expect(canTransition('PAID', 'COMPLETED', 'TECHNICIAN')).toBe(false);
  });

  it('runs the field steps for technicians in order', () => {
    expect(nextStatuses('ASSIGNED', 'TECHNICIAN')).toEqual(['EN_ROUTE']);
    expect(nextStatuses('EN_ROUTE', 'TECHNICIAN')).toEqual(['ON_SITE']);
    expect(nextStatuses('ON_SITE', 'TECHNICIAN')).toEqual(['INSTALLED']);
    expect(nextStatuses('INSTALLED', 'TECHNICIAN')).toEqual(['PAID']);
  });

  it('forbids cancelling after installation and leaving terminal states', () => {
    expect(canTransition('INSTALLED', 'CANCELLED', 'SUPER_ADMIN')).toBe(false);
    expect(nextStatuses('COMPLETED', 'SUPER_ADMIN')).toEqual([]);
    expect(nextStatuses('CANCELLED', 'SUPER_ADMIN')).toEqual([]);
  });
});
