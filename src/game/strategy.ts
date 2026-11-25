// Shared heuristics used by computer players.
import type { Asset, MarketEffect, Player, StockDeal } from './types'

export function marketPrice(effect: Extract<MarketEffect, { type: 'buyer' }>, asset: Asset): number {
  if (effect.prices && effect.prices[asset.category] !== undefined) return effect.prices[asset.category]
  if (effect.multiple) return effect.multiple * Math.max(0, asset.cashflow)
  if (effect.perUnit) return effect.perUnit * (asset.units ?? 1)
  return effect.price ?? 0
}

export function botWantsToSellStock(p: Player, card: StockDeal): number {
  const holding = p.assets.find((a) => a.kind === 'stock' && a.ticker === card.ticker)
  if (!holding || !holding.shares || card.ticker === 'YELD') return 0
  const [, high] = card.range
  const avg = holding.avgPrice ?? 0
  if (card.price >= high * 0.6 || (card.price >= avg * 4 && card.price >= high * 0.4)) return holding.shares
  return 0
}

export function botWantsToSellAsset(asset: Asset, price: number): boolean {
  const proceeds = price - asset.debt
  if (proceeds <= 0) return false
  if (asset.cashflow <= 0) return proceeds > asset.down
  return proceeds >= Math.max(asset.down * 2.5, asset.cashflow * 48)
}
