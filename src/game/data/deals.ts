import type { AssetDeal, DealCard, StockDeal } from '../types'

export const TICKERS: Record<string, { name: string; sector: string; range: [number, number]; dividend?: number }> = {
  NOVA: { name: 'Nova Robotics', sector: 'Tech stock', range: [5, 40] },
  ZAPP: { name: 'Zapp Charging', sector: 'EV infrastructure stock', range: [1, 30] },
  MEDX: { name: 'Medix Bio', sector: 'Biotech stock', range: [1, 50] },
  MOON: { name: 'MoonCoin', sector: 'Crypto token', range: [1, 60] },
  YELD: { name: 'Steady Yield Fund', sector: 'Dividend index fund', range: [10, 14], dividend: 0.1 },
}

const stockText: Record<string, (p: number) => string> = {
  NOVA: (p) =>
    p <= 10
      ? `A product recall knocked Nova Robotics down to $${p}. Analysts are split on a comeback.`
      : p >= 30
        ? `Nova Robotics hits $${p} on news of a warehouse-automation contract. Holders are cheering.`
        : `Nova Robotics trades at $${p} after a steady quarter.`,
  ZAPP: (p) =>
    p <= 5
      ? `EV charging stocks crater. Zapp Charging is down to $${p} as rates spike.`
      : p >= 20
        ? `Zapp Charging soars to $${p} after a federal infrastructure grant.`
        : `Zapp Charging trades at $${p}. The road ahead is electric, maybe.`,
  MEDX: (p) =>
    p <= 5
      ? `Medix Bio's trial was delayed. Shares slump to $${p}.`
      : p >= 40
        ? `Medix Bio wins approval for a new drug. Shares rocket to $${p}!`
        : `Medix Bio trades at $${p} while waiting for trial results.`,
  MOON: (p) =>
    p <= 5
      ? `Crypto winter. MoonCoin limps along at $${p}. Most people have given up on it.`
      : p >= 30
        ? `MoonCoin mania! Everyone at the gym is talking about it at $${p}.`
        : `MoonCoin trades at $${p}, swinging 20% a day.`,
  YELD: (p) => `The Steady Yield Fund trades at $${p} and pays a monthly dividend of $0.10 per share.`,
}

function stock(ticker: string, price: number, n = 1): StockDeal[] {
  const t = TICKERS[ticker]
  return Array.from({ length: n }, (_, i) => ({
    id: `s-${ticker}-${price}-${i}`,
    kind: 'stock' as const,
    ticker,
    price,
    dividend: t.dividend,
    range: t.range,
    title: `${t.name} (${ticker}) at $${price}`,
    text: stockText[ticker](price),
    lesson:
      ticker === 'YELD'
        ? 'Dividend funds pay you to hold them. That is passive income.'
        : ticker === 'MOON'
          ? 'Speculation pays only when you sell. Never bet the rent.'
          : 'Buy low, sell high. Know the trading range before you buy.',
  }))
}

let n = 0
function asset(d: Omit<AssetDeal, 'id' | 'kind'>): AssetDeal {
  n += 1
  return { id: `a-${n}`, kind: 'asset', ...d }
}

export const SMALL_DEALS: DealCard[] = [
  ...stock('NOVA', 5),
  ...stock('NOVA', 10),
  ...stock('NOVA', 20),
  ...stock('NOVA', 30),
  ...stock('NOVA', 40),
  ...stock('ZAPP', 1),
  ...stock('ZAPP', 5),
  ...stock('ZAPP', 10),
  ...stock('ZAPP', 20),
  ...stock('ZAPP', 30),
  ...stock('MEDX', 1),
  ...stock('MEDX', 5),
  ...stock('MEDX', 20),
  ...stock('MEDX', 40),
  ...stock('MEDX', 50),
  ...stock('MOON', 1),
  ...stock('MOON', 5),
  ...stock('MOON', 30),
  ...stock('MOON', 60),
  ...stock('YELD', 10),
  ...stock('YELD', 12),
  ...stock('YELD', 14),
  asset({
    assetKind: 'realestate', category: 'condo', name: 'Condo 2BR/1BA',
    title: 'Starter Condo', text: 'A seller relocating for work wants out of their 2BR/1BA condo, fast.',
    cost: 48000, down: 4000, cashflow: 180, units: 1,
    lesson: 'Positive cash flow from day one. The tenant pays down your mortgage.',
  }),
  asset({
    assetKind: 'realestate', category: 'condo', name: 'Condo 2BR/1BA (foreclosure)',
    title: 'Foreclosed Condo', text: 'The bank just wants this 2BR/1BA condo off its books.',
    cost: 40000, down: 3000, cashflow: 220, units: 1,
    lesson: 'You make money when you buy, not when you sell.',
  }),
  asset({
    assetKind: 'realestate', category: 'condo', name: 'Condo 2BR/2BA (new build)',
    title: 'Shiny New Condo', text: 'A developer offers a brand-new condo with "great appreciation potential".',
    cost: 70000, down: 5000, cashflow: -60, units: 1,
    lesson: 'Negative cash flow is a liability, even when it is called an investment.',
  }),
  asset({
    assetKind: 'realestate', category: 'condo', name: 'Condo 1BR/1BA',
    title: 'Downtown Studio Condo', text: 'Small, central, and easy to rent to students.',
    cost: 45000, down: 3500, cashflow: 190, units: 1,
  }),
  asset({
    assetKind: 'realestate', category: 'house', name: 'House 3BR/2BA',
    title: 'Starter House', text: 'An older 3BR/2BA in a solid neighborhood. Tenant already in place.',
    cost: 65000, down: 4000, cashflow: 280, units: 1,
    lesson: 'An existing tenant means cash flow starts immediately.',
  }),
  asset({
    assetKind: 'realestate', category: 'house', name: 'House 3BR/2BA (bank-owned)',
    title: 'Bank-Owned House', text: 'An REO listing that slipped past other investors. Needs paint, not much else.',
    cost: 55000, down: 3000, cashflow: 320, units: 1,
  }),
  asset({
    assetKind: 'realestate', category: 'house', name: 'House 3BR/2BA (fixer)',
    title: 'Fixer-Upper', text: 'A 3BR/2BA that has seen better days. Rent is low until you fix it up.',
    cost: 80000, down: 5000, cashflow: 160, units: 1,
  }),
  asset({
    assetKind: 'realestate', category: 'house', name: 'House 3BR/2BA (premium)',
    title: "Agent's Hot Pick", text: 'Your realtor insists this house will "only go up". The rent does not cover the mortgage.',
    cost: 95000, down: 5000, cashflow: -100, units: 1,
    lesson: 'Run the numbers yourself. Commission-driven advice is not your advice.',
  }),
  asset({
    assetKind: 'realestate', category: 'house', name: 'House 3BR/2BA',
    title: 'Estate Sale House', text: "Heirs who live out of state want a quick sale on their parents' home.",
    cost: 60000, down: 3000, cashflow: 260, units: 1,
  }),
  asset({
    assetKind: 'business', category: 'vending', name: 'Vending machine route',
    title: 'Vending Machine Route', text: 'Six machines in office lobbies. You restock once a week.',
    cost: 3000, down: 3000, cashflow: 150,
    lesson: 'Small systems that run without you are the first step out of the Grind.',
  }),
  asset({
    assetKind: 'business', category: 'vending', name: 'Arcade claw machines',
    title: 'Claw Machines', text: 'Three claw machines in a busy laundromat. Kids love them.',
    cost: 4000, down: 4000, cashflow: 180,
  }),
  asset({
    assetKind: 'business', category: 'vending', name: 'ATM placements',
    title: 'ATM Placements', text: 'Two ATMs in late-night convenience stores. You earn a cut of every fee.',
    cost: 2500, down: 2500, cashflow: 130,
  }),
  asset({
    assetKind: 'business', category: 'digital', name: 'Print-on-demand store',
    title: 'Print-on-Demand Store', text: 'An existing online T-shirt shop with steady sales. Fulfillment is automated.',
    cost: 2000, down: 2000, cashflow: 110,
    lesson: 'Digital assets can earn while you sleep.',
  }),
  asset({
    assetKind: 'business', category: 'digital', name: 'Niche mobile app',
    title: 'Buy a Small App', text: 'A solo developer is selling a habit-tracker app that earns ad revenue.',
    cost: 3000, down: 3000, cashflow: 160,
  }),
  asset({
    assetKind: 'business', category: 'digital', name: 'Online course',
    title: 'Record an Online Course', text: 'Turn your work skills into a video course. Pay for gear and editing up front.',
    cost: 1500, down: 1500, cashflow: 100,
  }),
  asset({
    assetKind: 'business', category: 'kiosk', name: 'Water & ice kiosk',
    title: 'Water & Ice Kiosk', text: 'A self-serve kiosk at a busy gas station. Low upkeep.',
    cost: 5000, down: 5000, cashflow: 240,
  }),
  asset({
    assetKind: 'business', category: 'note', name: 'Small-business loan note',
    title: 'Lend to a Local Bakery', text: 'A bakery owner needs $2,000 for an oven and will pay you monthly interest.',
    cost: 2000, down: 2000, cashflow: 50,
    lesson: 'Being the bank is an asset, as long as the borrower pays.',
  }),
  asset({
    assetKind: 'savings', category: 'tbill', name: 'Treasury bills',
    title: 'Treasury Bills', text: 'Safe, boring, guaranteed. Park $5,000 for a tiny monthly yield.',
    cost: 5000, down: 5000, cashflow: 20,
    lesson: 'Savers rarely get rich. Safe money works slowly.',
  }),
  asset({
    assetKind: 'collectible', category: 'sneakers', name: 'Limited sneaker lot',
    title: 'Limited Sneaker Drop', text: 'You can grab 5 pairs of a hyped collab at retail. No income, but resale buyers exist.',
    cost: 1500, down: 1500, cashflow: 0,
    lesson: 'Collectibles pay nothing until a buyer shows up.',
  }),
  asset({
    assetKind: 'collectible', category: 'cards', name: 'Vintage trading cards',
    title: 'Vintage Trading Cards', text: 'A box of graded rookie cards at an estate sale.',
    cost: 2000, down: 2000, cashflow: 0,
  }),
  asset({
    assetKind: 'collectible', category: 'domain', name: 'Premium domain name',
    title: 'Snag a Domain', text: 'A short, catchy .com just expired. You can register it.',
    cost: 500, down: 500, cashflow: 0,
  }),
  asset({
    assetKind: 'land', category: 'land', name: '5 acres of raw land',
    title: 'Raw Land', text: 'Five acres at the edge of town. No income, but the town keeps growing.',
    cost: 4000, down: 4000, cashflow: 0,
    lesson: 'Land is a bet on the future. It costs you while you wait.',
  }),
]

export const BIG_DEALS: DealCard[] = [
  asset({
    assetKind: 'realestate', category: 'plex', name: 'Duplex', units: 2,
    title: 'Side-by-Side Duplex', text: 'Two units, two tenants, one roof. The seller is retiring.',
    cost: 120000, down: 10000, cashflow: 300,
  }),
  asset({
    assetKind: 'realestate', category: 'plex', name: 'Duplex', units: 2,
    title: 'Duplex Near Campus', text: 'Always rented and always a little loud.',
    cost: 140000, down: 14000, cashflow: 420,
  }),
  asset({
    assetKind: 'realestate', category: 'plex', name: '4-plex', units: 4,
    title: 'Fourplex', text: 'A well-kept fourplex with long-term tenants and a new roof.',
    cost: 220000, down: 22000, cashflow: 900,
    lesson: 'More doors, more cash flow, and the vacancy risk is spread out.',
  }),
  asset({
    assetKind: 'realestate', category: 'plex', name: '4-plex (value-add)', units: 4,
    title: 'Tired Fourplex', text: 'Rents are below market. Good bones, bad landlord.',
    cost: 180000, down: 18000, cashflow: 500,
  }),
  asset({
    assetKind: 'realestate', category: 'plex', name: '8-plex', units: 8,
    title: 'Eight-Unit Building', text: 'A brick 8-plex near a hospital. Nurses and residents rent here for years.',
    cost: 360000, down: 36000, cashflow: 1600,
  }),
  asset({
    assetKind: 'realestate', category: 'plex', name: '8-plex (mismanaged)', units: 8,
    title: 'Cheap Eight-Plex', text: 'Low down payment, but half the units are vacant and the manager quit.',
    cost: 300000, down: 30000, cashflow: 300,
    lesson: 'A low price does not make a good deal. Cash flow does.',
  }),
  asset({
    assetKind: 'realestate', category: 'apartment', name: '12-unit apartments', units: 12,
    title: '12-Unit Apartment Building', text: 'An off-market building from a tired landlord. The paperwork is solid.',
    cost: 520000, down: 50000, cashflow: 2400,
  }),
  asset({
    assetKind: 'realestate', category: 'apartment', name: '24-unit apartment complex', units: 24,
    title: '24-Unit Complex', text: 'A garden-style complex with a pool and laundry income.',
    cost: 1100000, down: 100000, cashflow: 4800,
    lesson: 'Big deals need partners or leverage. Your banker becomes your best friend.',
  }),
  asset({
    assetKind: 'realestate', category: 'apartment', name: '40-unit apartment complex', units: 40,
    title: '40-Unit Complex', text: 'A syndicator is short one investor for a large complex. Your stake buys a full share.',
    cost: 1800000, down: 160000, cashflow: 7600,
  }),
  asset({
    assetKind: 'realestate', category: 'house', name: 'House 3BR/2BA (suburbs)', units: 1,
    title: 'Suburban Rental House', text: 'A 3BR/2BA in a top school district. Families line up to rent it.',
    cost: 120000, down: 12000, cashflow: 250,
  }),
  asset({
    assetKind: 'realestate', category: 'str', name: 'Mountain cabin (short-term rental)', units: 1,
    title: 'Short-Term Rental Cabin', text: 'A cabin near ski trails, fully furnished and booked most weekends.',
    cost: 190000, down: 19000, cashflow: 700,
  }),
  asset({
    assetKind: 'realestate', category: 'condo', name: 'Luxury condo', units: 1,
    title: 'Luxury Penthouse Condo', text: "Floor-to-ceiling windows. The HOA fees are huge, and so is everyone's ego.",
    cost: 300000, down: 30000, cashflow: 100,
    lesson: 'You are paying for status, and status does not pay you.',
  }),
  asset({
    assetKind: 'business', category: 'laundromat', name: 'Laundromat',
    title: 'Neighborhood Laundromat', text: 'A 30-machine laundromat with card readers. The owner wants to retire.',
    cost: 150000, down: 25000, cashflow: 1200,
  }),
  asset({
    assetKind: 'business', category: 'carwash', name: 'Express car wash',
    title: 'Express Car Wash', text: 'Membership-based car wash with 800 monthly subscribers.',
    cost: 280000, down: 45000, cashflow: 2200,
    lesson: 'Subscriptions create predictable cash flow.',
  }),
  asset({
    assetKind: 'business', category: 'restaurant', name: 'Pizzeria',
    title: 'Local Pizzeria', text: 'A beloved pizza spot with a great manager who wants to stay on.',
    cost: 120000, down: 20000, cashflow: 900,
  }),
  asset({
    assetKind: 'business', category: 'restaurant', name: 'Food truck',
    title: 'Taco Food Truck', text: 'A fully equipped truck with a cook and a following.',
    cost: 40000, down: 8000, cashflow: 400,
  }),
  asset({
    assetKind: 'realestate', category: 'storage', name: 'Self-storage facility', units: 120,
    title: 'Self-Storage Facility', text: '120 units, gated, mostly automated. People always have too much stuff.',
    cost: 400000, down: 50000, cashflow: 2800,
  }),
  asset({
    assetKind: 'realestate', category: 'park', name: 'Mobile home park', units: 40,
    title: 'Mobile Home Park', text: '40 lots with tenant-owned homes. You rent the land.',
    cost: 500000, down: 60000, cashflow: 3500,
  }),
  asset({
    assetKind: 'realestate', category: 'commercial', name: 'Dental office building',
    title: 'Medical Office Building', text: 'A small building leased to a dental practice on a 10-year lease.',
    cost: 300000, down: 30000, cashflow: 1300,
  }),
  asset({
    assetKind: 'realestate', category: 'commercial', name: 'Strip mall',
    title: 'Neighborhood Strip Mall', text: 'Six storefronts: a nail salon, a phone repair shop, and four others.',
    cost: 900000, down: 90000, cashflow: 4200,
  }),
  asset({
    assetKind: 'land', category: 'land', name: '40 acres by the highway',
    title: 'Land by the New Highway', text: 'Forty acres where a new highway interchange is rumored.',
    cost: 20000, down: 20000, cashflow: 0,
    lesson: 'Information is an asset. Rumors are not.',
  }),
  asset({
    assetKind: 'business', category: 'gym', name: 'Franchise gym',
    title: 'Franchise Gym', text: 'A 24-hour gym franchise with 1,200 members.',
    cost: 350000, down: 50000, cashflow: 1800,
  }),
  asset({
    assetKind: 'business', category: 'digital', name: 'E-commerce brand',
    title: 'Online Pet-Supply Brand', text: 'A profitable online store with loyal subscribers. The founder is burned out.',
    cost: 60000, down: 60000, cashflow: 1000,
  }),
  asset({
    assetKind: 'business', category: 'solar', name: 'Solar install company stake',
    title: 'Solar Installer Partnership', text: 'Buy a 25% stake in a growing solar installation company.',
    cost: 30000, down: 30000, cashflow: 700,
  }),
]

export const DEAL_CARDS: Record<string, DealCard> = Object.fromEntries(
  [...SMALL_DEALS, ...BIG_DEALS].map((c) => [c.id, c]),
)
