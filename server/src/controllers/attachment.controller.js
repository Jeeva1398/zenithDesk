const catchAsync = require('../utils/catchAsync');
const attachmentService = require('../services/attachment.service');

const addAttachment = catchAsync(async (req, res) => {
  const attachment = await attachmentService.addAttachment(
    req.agent.orgId,
    req.params.id,
    req.file,
    req.agent,
  );
  res.status(201).json(attachment);
});

const downloadAttachment = catchAsync(async (req, res) => {
  const { attachment, fullPath } = await attachmentService.getForDownload(
    req.agent.orgId,
    req.params.id,
    req.params.attachmentId,
  );

  // Always a download, never rendered in place: the file came from a member
  // of the public, and nosniff (set by helmet) stops a browser second-guessing
  // the type we checked on the way in.
  res.setHeader('Content-Type', attachment.mime_type);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
  );
  res.setHeader('Cache-Control', 'private, no-store');
  // send() 404s any path with a dot-segment by default, which would break an
  // UPLOAD_DIR under a dotted folder. The path is ours and already confined to
  // UPLOAD_DIR by the service, so that guard has nothing left to protect.
  res.sendFile(fullPath, { dotfiles: 'allow' });
});

module.exports = { addAttachment, downloadAttachment };
