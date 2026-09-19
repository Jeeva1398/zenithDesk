const catchAsync = require('../utils/catchAsync');
const macroService = require('../services/macro.service');

const listMacros = catchAsync(async (req, res) => {
  const result = await macroService.listMacros(req.agent.orgId);
  res.status(200).json(result);
});

const createMacro = catchAsync(async (req, res) => {
  const macro = await macroService.createMacro(req.agent.orgId, req.agent.id, req.body);
  res.status(201).json(macro);
});

const updateMacro = catchAsync(async (req, res) => {
  const macro = await macroService.updateMacro(req.agent.orgId, req.params.id, req.body);
  res.status(200).json(macro);
});

const deleteMacro = catchAsync(async (req, res) => {
  await macroService.deleteMacro(req.agent.orgId, req.params.id);
  res.status(204).send();
});

const applyMacro = catchAsync(async (req, res) => {
  const ticket = await macroService.applyMacro(
    req.agent.orgId,
    req.agent.id,
    req.params.id,
    req.body.macroId,
  );
  res.status(200).json(ticket);
});

module.exports = { listMacros, createMacro, updateMacro, deleteMacro, applyMacro };
