import { describe, expect, it } from 'vitest';
import { parseDoctorOfCreditHtml } from '../src/crawlers/us/doctor-of-credit';
import { parseUsCreditCardGuidePages } from '../src/crawlers/us/us-credit-card-guide';

const now = new Date('2026-05-17T00:00:00.000Z');

describe('US Credit Card Guide parser', () => {
  it('extracts card and welcome offer data from static card pages', () => {
    const pageUrl = 'https://www.uscreditcardguide.com/chase-sapphire-preferred-credit-card/';
    const result = parseUsCreditCardGuidePages(
      [
        {
          url: pageUrl,
          html: `
            <main>
              <article>
                <h1>Chase Sapphire Preferred Credit Card</h1>
                <p>The current offer is 80,000 points after $4,000 spend in 3 months.</p>
                <p>Annual fee is $95.</p>
              </article>
            </main>
          `,
        },
      ],
      now,
    );

    expect(result.source.id).toBe('us-uscreditcardguide');
    expect(result.cards.length).toBeGreaterThanOrEqual(1);
    expect(result.offers.length).toBeGreaterThanOrEqual(1);

    const card = result.cards[0];
    expect(card).toMatchObject({ region: 'US', issuer: 'Chase' });
    expect(card?.sourceUrls).toContain(pageUrl);

    const offer = result.offers[0];
    expect(offer).toMatchObject({ sourceReliability: 'aggregator', sourceUrl: pageUrl });
    expect(offer?.valueText).toContain('开卡奖励优惠');
    expect(offer?.valueText).toContain('80,000 点');
    expect(offer?.originalText).toBeTruthy();
  });

  it('uses page identity instead of navigation text when inferring issuer', () => {
    const pageUrl = 'https://www.uscreditcardguide.com/chase-sapphire-preferred-credit-card/';
    const result = parseUsCreditCardGuidePages(
      [
        {
          url: pageUrl,
          html: `
            <main>
              <article>
                <nav>Credit Cards Chase American Express Capital One Citi</nav>
                <h1>Chase Sapphire Preferred Credit Card</h1>
                <p>The current offer is 80,000 points after $4,000 spend in 3 months.</p>
                <p>Annual fee is $95.</p>
              </article>
            </main>
          `,
        },
      ],
      now,
    );

    const card = result.cards[0];
    expect(card).toMatchObject({ issuer: 'Chase', name: 'Chase Sapphire Preferred Credit Card' });
    expect(card?.id).toBe('us-uscreditcardguide-chase-sapphire-preferred-credit-card');
    expect(card?.issuer).not.toBe('Capital One');
  });

  it('normalizes review and update suffixes from USCCG card titles', () => {
    const result = parseUsCreditCardGuidePages(
      [
        {
          url: 'https://www.uscreditcardguide.com/chase-sapphire-preferred-credit-card/',
          html: `
            <main>
              <article>
                <h1>Chase Sapphire Preferred® (CSP) Review (2025.6 Update: 75k Offer)</h1>
                <p>The current offer is 75,000 points after $4,000 spend in 3 months.</p>
                <p>Annual fee is $95.</p>
              </article>
            </main>
          `,
        },
      ],
      now,
    );

    expect(result.cards[0]?.name).toBe('Chase Sapphire Preferred Credit Card');
    expect(result.cards[0]?.name).not.toContain('Review');
    expect(result.cards[0]?.name).not.toContain('Update');
  });

  it('uses card-tied Capital One welcome text instead of unrelated Asia Miles body text', () => {
    const result = parseUsCreditCardGuidePages(
      [
        {
          url: 'https://www.uscreditcardguide.com/capital-one-venture-x-credit-card/',
          html: `
            <main>
              <article>
                <aside>Asia Miles 10,000 miles after $125 purchase</aside>
                <h1>Capital One Venture X Credit Card</h1>
                <p>Capital One Venture X Credit Card offers 75,000 miles after $4,000 spend in 3 months.</p>
                <p>Annual fee is $395.</p>
              </article>
            </main>
          `,
        },
      ],
      now,
    );

    const card = result.cards[0];
    const offer = result.offers[0];
    expect(card?.welcomeOffer?.headline).toContain('开卡奖励优惠');
    expect(card?.welcomeOffer?.headline).toContain('75,000 点');
    expect(card?.welcomeOffer?.headline).not.toContain('Asia Miles');
    expect(card?.welcomeOffer?.headline).not.toContain('US$125');
    expect(offer?.valueText).toContain('75,000 点');
    expect(offer?.valueText).not.toContain('Asia Miles');
    expect(offer?.valueText).not.toContain('US$125');
  });

  it('skips Capital One pages that only contain unrelated welcome signals', () => {
    const result = parseUsCreditCardGuidePages(
      [
        {
          url: 'https://www.uscreditcardguide.com/capital-one-venture-x-credit-card/',
          html: `
            <main>
              <article>
                <h1>Capital One Venture X Credit Card</h1>
                <aside>Asia Miles 10,000 miles after $125 purchase</aside>
                <p>No current card-specific welcome bonus details are listed here.</p>
              </article>
            </main>
          `,
        },
      ],
      now,
    );

    expect(result.cards).toHaveLength(0);
    expect(result.offers).toHaveLength(0);
    expect(result.refreshedSourceUrls).toContain('https://www.uscreditcardguide.com/capital-one-venture-x-credit-card/');
  });
});

describe('Doctor of Credit parser', () => {
  it('extracts welcome offer signals from static best-bonus article HTML', () => {
    const result = parseDoctorOfCreditHtml(
      `
        <main>
          <article>
            <h1>Best Current Credit Card Sign Up Bonuses</h1>
            <ul>
              <li>Chase Sapphire Preferred 80,000 points after $4,000 spend</li>
            </ul>
            <section id="comments">
              <p>Comment mentioning Capital One should not be parsed initially.</p>
            </section>
          </article>
        </main>
      `,
      now,
    );

    expect(result.source.id).toBe('us-doctor-of-credit');
    expect(result.cards).toHaveLength(0);
    expect(result.offers.length).toBeGreaterThanOrEqual(1);

    const offer = result.offers[0];
    expect(offer).toMatchObject({ issuer: 'Chase', category: 'welcome', sourceReliability: 'aggregator' });
    expect(offer?.title).toContain('Chase');
    expect(offer?.valueText).toContain('开卡奖励优惠');
  });

  it('skips unknown issuer and card bonus lines instead of defaulting to US Bank', () => {
    const result = parseDoctorOfCreditHtml(
      `
        <main>
          <article>
            <ul>
              <li>Mystery Rewards Card 80,000 points after $4,000 spend</li>
            </ul>
          </article>
        </main>
      `,
      now,
    );

    expect(result.offers).toHaveLength(0);
    expect(result.offers.some((offer) => offer.issuer === 'US Bank')).toBe(false);
  });
});
