// The two products an org can use, as the portal draws them. Both run on the
// same org, team, contacts and knowledge base; the server answers 403
// product_not_enabled for anything of a product the org does not have.
export const PRODUCTS = {
  desk: {
    key: 'desk',
    name: 'ZenithDesk Desk',
    short: 'Desk',
    home: '/tickets',
    tagline: 'A shared inbox for support tickets',
    features: [
      'Tickets from email, the customer portal and the chat widget',
      'SLA targets for first response and resolution',
      'Macros, saved views and tags for the team',
      'A portal where customers follow their own tickets',
    ],
  },
  chat: {
    key: 'chat',
    name: 'ZenithDesk Chat',
    short: 'Chat',
    home: '/dashboard?view=chatbot',
    tagline: 'An AI assistant on your website that answers from your knowledge base',
    features: [
      'Answers questions from your knowledge base, with its sources',
      'Takes down sales enquiries and leads',
      'Hands a conversation to a person when a visitor asks for one',
      'Analytics on what the bot answered and what it missed',
    ],
  },
};

export const PRODUCT_KEYS = Object.keys(PRODUCTS);

// Sessions saved before products existed carry none; every org had both then.
export function productsOf(agent) {
  return Array.isArray(agent?.products) ? agent.products : PRODUCT_KEYS;
}

// Where the portal opens: Desk's queue when the org has it, else Chat's numbers.
export function homePath(products) {
  const first = PRODUCT_KEYS.find((key) => products.includes(key));
  return first ? PRODUCTS[first].home : '/settings';
}
