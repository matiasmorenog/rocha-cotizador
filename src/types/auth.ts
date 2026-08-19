/** Rocha staff roles (usuarios UI — not SUPERUSER). */
export type StaffRole = "ADMIN" | "QUOTES" | "STOCK";

/** Platform owner role — not combinable with staff switches. */
export type SuperuserRole = "SUPERUSER";

/** JWT / session role — staff, platform owner, or customer. */
export type AppRole = StaffRole | SuperuserRole | "CUSTOMER";

export type CustomerModuleSession = "MERMAS" | "CONSUMABLES";
