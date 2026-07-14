export type UserRole = 'owner' | 'kasir' | 'dapur'

/** Landing route for each role after login (user-flow-ia §site map). */
export function homeForRole(role: UserRole): string {
  switch (role) {
    case 'owner':
      return '/owner/dashboard'
    case 'kasir':
      return '/kasir'
    case 'dapur':
      return '/dapur'
  }
}
