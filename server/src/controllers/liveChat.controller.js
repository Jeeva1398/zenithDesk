const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const liveChatService = require('../services/liveChat.service');

// These routes take the chatbot's service token as well as an agent's. The
// chatbot speaks for the visitor, and names the conversation it is speaking
// for; an agent speaks as themselves.
function isService(req) {
  return req.agent.role === 'service';
}

function requireAgent(req) {
  if (isService(req)) throw new ApiError(403, 'Only an agent can do this');
}

function serviceSession(req, source) {
  const sessionId = source.sessionId;
  if (typeof sessionId !== 'string' || !sessionId) throw new ApiError(400, 'sessionId is required');
  return sessionId;
}

const openChat = catchAsync(async (req, res) => {
  if (!isService(req)) throw new ApiError(403, 'Live chats are opened from the chat widget');
  res.status(201).json(await liveChatService.openChat(req.agent.orgId, req.body || {}));
});

const listChats = catchAsync(async (req, res) => {
  res.status(200).json(await liveChatService.listChats(req.agent.orgId));
});

const getCounts = catchAsync(async (req, res) => {
  res.status(200).json(await liveChatService.counts(req.agent.orgId, req.agent.id));
});

const getChat = catchAsync(async (req, res) => {
  res.status(200).json(await liveChatService.getChat(req.agent.orgId, req.params.id));
});

const listMessages = catchAsync(async (req, res) => {
  const options = { after: req.query.after };
  if (isService(req)) options.sessionId = serviceSession(req, req.query);
  res.status(200).json(await liveChatService.listMessages(req.agent.orgId, req.params.id, options));
});

const addMessage = catchAsync(async (req, res) => {
  const body = req.body || {};
  if (isService(req)) {
    const sessionId = serviceSession(req, body);
    res.status(201).json(await liveChatService.addVisitorMessage(req.agent.orgId, req.params.id, { sessionId, body: body.body }));
    return;
  }
  res.status(201).json(await liveChatService.addAgentMessage(req.agent.orgId, req.params.id, req.agent, body));
});

const joinChat = catchAsync(async (req, res) => {
  requireAgent(req);
  res.status(200).json(await liveChatService.joinChat(req.agent.orgId, req.params.id, req.agent));
});

const closeChat = catchAsync(async (req, res) => {
  const options = isService(req) ? { sessionId: serviceSession(req, req.body || {}) } : { agent: req.agent };
  res.status(200).json(await liveChatService.closeChat(req.agent.orgId, req.params.id, options));
});

module.exports = { openChat, listChats, getCounts, getChat, listMessages, addMessage, joinChat, closeChat };
