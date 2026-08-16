/** Primary staff role on User (email login). */
export type StaffRole = "ADMIN" | "QUOTES" | "STOCK";

/** JWT / session role — staff or customer. */
export type AppRole = StaffRole | "CUSTOMER";

export type CustomerModuleSession = "MERMAS" | "CONSUMABLES";
