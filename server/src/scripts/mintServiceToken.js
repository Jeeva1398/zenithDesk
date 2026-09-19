require('dotenv').config();

const { validateEnv } = require('../config/env');
const { signToken, TOKEN_TYPES } = require('../utils/token');

// Mints the token the chatbot puts in TICKET_API_TOKEN. It may create a ticket
// and nothing else - unlike the agent token this replaces, which could read
// every ticket and customer in the organization.
//
//   npm run token:service -- --org 1 --expires 365d
function parseArgs(argv) {
  const args = { orgId: 1, expiresIn: '365d' };

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--org') {
      args.orgId = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--expires') {
      args.expiresIn = argv[i + 1];
      i += 1;
    }
  }

  if (!Number.isInteger(args.orgId) || args.orgId < 1) {
    throw new Error('--org must be a positive integer');
  }
  return args;
}

function main() {
  validateEnv();
  const { orgId, expiresIn } = parseArgs(process.argv.slice(2));

  const token = signToken({ typ: TOKEN_TYPES.SERVICE, orgId }, { expiresIn });

  process.stdout.write(`${token}\n`);
  process.stderr.write(
    `\nService token for org ${orgId}, valid ${expiresIn}.\n` +
      'It can create tickets and nothing else. Put it in the chatbot\'s TICKET_API_TOKEN.\n' +
      'Rotating it is just running this again; the old one stays valid until it expires.\n',
  );
}

if (require.main === module) {
  main();
}

module.exports = { parseArgs };
