import { toPaise as R } from "@/lib/money";
import type { Category, FoodType, MenuItem, ModifierGroup } from "@/types/domain";

interface Def {
  name: string;
  cat: string;
  price: number;
  food: FoodType;
  desc: string;
  popular?: boolean;
  tax?: number;
  variants?: [string, number][];
  groups?: string[];
  off?: boolean;
}

const GROUPS: Record<string, [string, number, [string, number][]]> = {
  coffee: ["Coffee add-ons", 2, [["Extra Shot", 40], ["Whipped Cream", 30], ["Oat Milk", 50]]],
  pizza: ["Pizza extras", 3, [["Extra Cheese", 40], ["Extra Sauce", 20], ["Jalapeños", 25]]],
  fries: ["Fries extras", 2, [["Peri Peri Masala", 20], ["Cheese Dip", 30]]],
  biryani: ["Biryani extras", 3, [["Extra Raita", 25], ["Boiled Egg", 20], ["Extra Gravy", 30]]],
  dessert: ["Dessert extras", 1, [["Ice Cream Scoop", 50], ["Hot Fudge", 30]]],
};

const DEFS: Def[] = [
  // Starters
  { name: "Paneer Tikka", cat: "Starters", price: 240, food: "VEG", popular: true, desc: "Tandoor-grilled cottage cheese, mint chutney" },
  { name: "French Fries", cat: "Starters", price: 180, food: "VEG", popular: true, desc: "Skin-on, sea salt", variants: [["Regular", 180], ["Large", 230]], groups: ["fries"] },
  { name: "Chicken Tikka", cat: "Starters", price: 280, food: "NON_VEG", desc: "Smoked, yogurt-marinated chicken" },
  { name: "Veg Spring Rolls", cat: "Starters", price: 190, food: "VEG", desc: "Crisp rolls with sweet chilli dip" },
  { name: "Chilli Chicken", cat: "Starters", price: 260, food: "NON_VEG", desc: "Wok-tossed, spring onion" },
  { name: "Hara Bhara Kebab", cat: "Starters", price: 220, food: "VEG", desc: "Spinach, peas and potato patties" },
  // Main Course
  { name: "Chicken Biryani", cat: "Main Course", price: 270, food: "NON_VEG", popular: true, desc: "Dum-cooked basmati, house masala, raita", groups: ["biryani"] },
  { name: "Veg Biryani", cat: "Main Course", price: 220, food: "VEG", desc: "Seasonal vegetables, saffron rice", groups: ["biryani"] },
  { name: "Butter Chicken", cat: "Main Course", price: 320, food: "NON_VEG", desc: "Tomato-cream gravy, kasuri methi" },
  { name: "Dal Makhani", cat: "Main Course", price: 240, food: "VEG", desc: "Slow-cooked black lentils" },
  { name: "Paneer Butter Masala", cat: "Main Course", price: 280, food: "VEG", desc: "Cottage cheese in rich tomato gravy" },
  { name: "Butter Naan", cat: "Main Course", price: 45, food: "VEG", desc: "Tandoor-baked" },
  { name: "Jeera Rice", cat: "Main Course", price: 140, food: "VEG", desc: "Cumin-tempered basmati" },
  { name: "Grilled Chicken Sandwich", cat: "Main Course", price: 210, food: "NON_VEG", desc: "Sourdough, pesto, cheddar" },
  // Pizza
  { name: "Margherita Pizza", cat: "Pizza", price: 299, food: "VEG", popular: true, desc: "San Marzano tomato, fior di latte, basil", variants: [["Regular", 299], ["Large", 449]], groups: ["pizza"] },
  { name: "Farmhouse Pizza", cat: "Pizza", price: 349, food: "VEG", desc: "Mushroom, capsicum, olives, onion", variants: [["Regular", 349], ["Large", 499]], groups: ["pizza"] },
  { name: "Pepperoni Pizza", cat: "Pizza", price: 399, food: "NON_VEG", desc: "Chicken pepperoni, mozzarella", variants: [["Regular", 399], ["Large", 549]], groups: ["pizza"] },
  { name: "Peri Peri Chicken Pizza", cat: "Pizza", price: 379, food: "NON_VEG", desc: "Peri peri chicken, red onion", variants: [["Regular", 379], ["Large", 529]], groups: ["pizza"], off: true },
  // Drinks
  { name: "Cold Coffee", cat: "Drinks", price: 160, food: "VEG", popular: true, desc: "Chilled, slow-blended", variants: [["Regular", 160], ["Large", 190]], groups: ["coffee"] },
  { name: "Masala Chai", cat: "Drinks", price: 80, food: "VEG", popular: true, desc: "Ginger, cardamom, full-cream milk" },
  { name: "Cappuccino", cat: "Drinks", price: 150, food: "VEG", desc: "Double shot, steamed milk", variants: [["Regular", 150], ["Large", 180]], groups: ["coffee"] },
  { name: "Americano", cat: "Drinks", price: 130, food: "VEG", desc: "Double shot, hot water", groups: ["coffee"] },
  { name: "Fresh Lime Soda", cat: "Drinks", price: 90, food: "VEG", desc: "Sweet, salted or mixed" },
  { name: "Mango Lassi", cat: "Drinks", price: 130, food: "VEG", desc: "Alphonso pulp, thick curd" },
  { name: "Iced Tea", cat: "Drinks", price: 140, food: "VEG", desc: "Peach or lemon" },
  { name: "Coke", cat: "Drinks", price: 60, food: "VEG", tax: 18, desc: "300 ml can" },
  // Desserts
  { name: "Brownie", cat: "Desserts", price: 190, food: "EGG", popular: true, desc: "Warm walnut brownie", groups: ["dessert"] },
  { name: "Gulab Jamun", cat: "Desserts", price: 120, food: "VEG", desc: "Two pieces, warm" },
  { name: "Tiramisu", cat: "Desserts", price: 240, food: "EGG", desc: "Espresso-soaked, mascarpone" },
  { name: "Baked Cheesecake", cat: "Desserts", price: 260, food: "VEG", desc: "New York style, berry compote" },
];

export const CATEGORY_ORDER = ["Starters", "Main Course", "Pizza", "Drinks", "Desserts"];

export function buildMenu(restaurantId: string, now: number, opts: { only?: number } = {}) {
  const categories: Category[] = CATEGORY_ORDER.map((name, i) => ({
    id: `cat_${restaurantId}_${i}`,
    restaurantId,
    name,
    sortOrder: i,
  }));
  const groups: ModifierGroup[] = Object.entries(GROUPS).map(([key, [name, max, mods]]) => ({
    id: `mg_${restaurantId}_${key}`,
    restaurantId,
    name,
    maxSelect: max,
    modifiers: mods.map(([n, p], i) => ({ id: `mod_${restaurantId}_${key}_${i}`, name: n, price: R(p) })),
  }));
  const defs = opts.only ? DEFS.filter((d) => d.popular).slice(0, opts.only) : DEFS;
  const items: MenuItem[] = defs.map((d, i) => ({
    id: `mi_${restaurantId}_${DEFS.indexOf(d)}`,
    restaurantId,
    categoryId: categories.find((c) => c.name === d.cat)!.id,
    name: d.name,
    description: d.desc,
    price: R(d.price),
    taxRate: d.tax ?? 5,
    foodType: d.food,
    sku: `${d.cat.slice(0, 2).toUpperCase()}-${String(DEFS.indexOf(d) + 101)}`,
    available: !d.off,
    popular: !!d.popular,
    variants: (d.variants ?? []).map(([n, p], vi) => ({ id: `mv_${restaurantId}_${DEFS.indexOf(d)}_${vi}`, name: n, price: R(p) })),
    modifierGroupIds: (d.groups ?? []).map((g) => `mg_${restaurantId}_${g}`),
    createdAt: now - 60 * 86_400_000 + i * 1000,
    updatedAt: now - 3 * 86_400_000,
  }));
  return { categories, groups, items };
}
