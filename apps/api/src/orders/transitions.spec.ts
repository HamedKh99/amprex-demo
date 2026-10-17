import { canTransition, nextStatuses } from '@amprex/shared';

describe('order transitions', () => {
  it('lets only office roles assign', () => {
    expect(canTransition('CREATED', 'ASSIGNED', 'OPERATOR')).toBe(true);
    expect(canTransition('CREATED', 'ASSIGNED', 'TECHNICIAN')).toBe(false);
  });

  it('runs the five field steps for technicians in order', () => {
    expect(nextStatuses('ASSIGNED', 'TECHNICIAN')).toEqual(['ACCEPTED']);
    expect(nextStatuses('ACCEPTED', 'TECHNICIAN')).toEqual(['EN_ROUTE']);
    expect(nextStatuses('EN_ROUTE', 'TECHNICIAN')).toEqual(['ON_SITE']);
    expect(nextStatuses('ON_SITE', 'TECHNICIAN')).toEqual(['INSTALLING']);
    expect(nextStatuses('INSTALLING', 'TECHNICIAN')).toEqual(['COMPLETED']);
  });

  it('lets the office reassign or cancel until completion, never after', () => {
    expect(nextStatuses('ACCEPTED', 'OPERATOR')).toEqual(['ASSIGNED', 'CANCELLED']);
    expect(canTransition('INSTALLING', 'CANCELLED', 'BRANCH_MANAGER')).toBe(true);
    expect(canTransition('INSTALLING', 'COMPLETED', 'OPERATOR')).toBe(false);
    expect(nextStatuses('COMPLETED', 'SUPER_ADMIN')).toEqual([]);
    expect(nextStatuses('CANCELLED', 'SUPER_ADMIN')).toEqual([]);
  });
});
