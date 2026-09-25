// quiet: dotenv 17 prints a tip to stdout, which would end up next to the token.
require('dotenv').config({ quiet: true });

const { validateEnv } = require('../config/env');
const { signToken, TOKEN_TYPES } = require('../utils/token');

// Mints the token the chatbot puts in TICKET_API_TOKEN. It may create tickets,
// attach the customer's files and search the knowledge base - nothing else -
// unlike the agent token this replaces, which could read every ticket and
// customer in the organization.
//
// By default the token is for the whole platform: it carries no org, and each
// request names the widget it is for, whose org it then acts in. One token,
// minted once, serves every org that signs up. --org ties it to one org
// instead, for a chatbot that should never act for anyone else.
//
//   npm run token:service -- --expires 365d
//   npm run token:service -- --org 1 --expires 365d
function parseArgs(argv) {
  const args = { orgId: null, expiresIn: '365d' };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--org') {
      args.orgId = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--expires') {
      args.expiresIn = argv[i + 1];
      i += 1;
    }
  }

  if (args.orgId !== null && (!Number.isInteger(args.orgId) || args.orgId < 1)) {
    throw new Error('--org must be a positive integer');
  }
  return args;
}

function main() {
  validateEnv();
  const { orgId, expiresIn } = parseArgs(process.argv.slice(2));

  const payload = orgId ? { typ: TOKEN_TYPES.SERVICE, orgId } : { typ: TOKEN_TYPES.SERVICE, scope: 'platform' };
  const token = signToken(payload, { expiresIn });

  const scope = orgId ? `Service token for org ${orgId}` : 'Platform service token (every org, by widget key)';
  process.stdout.write(`${token}\n`);
  process.stderr.write(
    `\n${scope}, valid ${expiresIn}.\n` +
      'It can create tickets, attach files and search the knowledge base, nothing else.\n' +
      "Put it in the chatbot's TICKET_API_TOKEN.\n" +
      'Rotating it is just running this again; the old one stays valid until it expires.\n',
  );
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs };
