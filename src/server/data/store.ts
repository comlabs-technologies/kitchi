import type {
  Category,
  Customer,
  Employee,
  InventoryItem,
  Membership,
  MenuItem,
  ModifierGroup,
  Order,
  Organization,
  Outlet,
  OutletSettings,
  Restaurant,
  RestaurantTable,
  StockMovement,
  User,
} from "@/types/domain";
import { seedDemo } from "./seed";

/**
 * In-memory datastore standing in for PostgreSQL. All access goes through repositories
 * (server/repositories), which are the only code that touches these arrays and which scope
 * every query by tenant. Swap the repositories for Prisma/Drizzle without touching services.
 */
export interface Store {
  organizations: Organization[];
  restaurants: Restaurant[];
  outlets: Outlet[];
  users: User[];
  memberships: Membership[];
  categories: Category[];
  menuItems: MenuItem[];
  modifierGroups: ModifierGroup[];
  tables: RestaurantTable[];
  orders: Order[];
  customers: Customer[];
  inventory: InventoryItem[];
  movements: StockMovement[];
  employees: Employee[];
  outletSettings: OutletSettings[];
  orderCounters: Record<string, number>; // `${outletId}:${dayKey}` → last seq
}

const g = globalThis as unknown as { __kitchiStore?: Store };

function create(): Store {
  const s: Store = {
    organizations: [],
    restaurants: [],
    outlets: [],
    users: [],
    memberships: [],
    categories: [],
    menuItems: [],
    modifierGroups: [],
    tables: [],
    orders: [],
    customers: [],
    inventory: [],
    movements: [],
    employees: [],
    outletSettings: [],
    orderCounters: {},
  };
  seedDemo(s);
  return s;
}

export const store: Store = (g.__kitchiStore ??= create());
