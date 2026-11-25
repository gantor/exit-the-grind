export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="howto-title" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn modal-close" onClick={onClose} aria-label="Close">✕</button>
        <h2 id="howto-title">How to play</h2>

        <h3>The goal</h3>
        <p>
          You start in <b>the Grind</b>: a job, monthly bills, and some debt. Your salary covers your expenses, but only
          just. To escape, build <b>passive income</b> (money from assets that arrives whether you work or not) until it is
          larger than your <b>total monthly expenses</b>.
        </p>

        <h3>Assets vs. liabilities</h3>
        <p>
          An <b>asset</b> puts money in your pocket every month: a rental, a business, a dividend fund. A <b>liability</b> takes money
          out: car loans, credit cards, splurges. Your statement shows both, updated live.
        </p>

        <h3>The board</h3>
        <ul>
          <li>💵 <b>Payday</b>: collect your monthly cash flow (salary + passive − expenses) whenever you land on or pass it.</li>
          <li>🔑 <b>Deal</b>: draw a Small Deal (≤ $5k) or a Big Deal. Buy it, or pass.</li>
          <li>📈 <b>Market</b>: buyers make offers on assets, stocks split or crash, rates change.</li>
          <li>🛍️ <b>Splurge</b>: lifestyle spending. Pay cash, or put it on the card and add a monthly payment.</li>
          <li>🎲 <b>Life</b>: babies, bonuses, bills and surprises.</li>
          <li>🤝 <b>Give Back</b>: donate 10% of income to roll extra dice for 3 turns.</li>
          <li>📦 <b>Laid off</b>: pay a month of expenses and sit out 2 turns.</li>
          <li>🎓 <b>Upskill</b>: pay for a course to permanently raise your salary.</li>
        </ul>

        <h3>Stocks &amp; crypto</h3>
        <p>
          A stock card names a price. Anyone holding that ticker can sell at that price. Buy near the bottom of the trading range
          and wait for a card near the top. Crypto swings wildest of all.
        </p>

        <h3>The bank</h3>
        <p>
          Borrow in $1,000 steps; each $1,000 adds $100 to your monthly expenses. The bank only lends while your payday stays
          positive. Pay off debts from your statement any time on your turn. If an emergency pushes your cash flow below zero,
          you go bankrupt: you lose your assets, your debts are cut, and you sit out 2 turns.
        </p>

        <h3>Freedom Lane</h3>
        <p>
          Once you escape, you choose a dream and move to Freedom Lane. Your freedom payday starts at 10× your passive income
          (at least $30,000). Buy ventures with cash to grow it. You win by landing on your dream with enough cash, or by
          adding $50,000 to your freedom payday.
        </p>

        <h3>Tips</h3>
        <ul>
          <li>Check the <b>return on cash</b>. Above 20% a year is a strong deal.</li>
          <li>Negative cash flow "investments" are liabilities in disguise.</li>
          <li>Keep a cash cushion for layoffs and babies.</li>
          <li>Selling a property into a hot market can fund a much bigger deal.</li>
        </ul>
        <div className="actions">
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
