// Permission khusus manajemen user/role — TIDAK boleh disamakan dengan scope konten.
// Hanya role `admin` yang memilikinya (seed). Dipakai sebagai gerbang `user.service`
// (list/create/update/delete/assignRole) agar role custom berpermission konten apa pun tetap 403.
export const ADMIN_ACCESS_PERMISSION = 'admin:access';

export function hasAdminAccess(codes: readonly string[]): boolean {
  return codes.includes(ADMIN_ACCESS_PERMISSION);
}
