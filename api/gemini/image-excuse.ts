import type { IncomingMessage, ServerResponse } from 'http';
import imageHandler from './image';

export default function handler(req: IncomingMessage & { body?: any; __action?: string }, res: ServerResponse) {
  req.__action = 'excuse';
  if (req.body && typeof req.body === 'object') {
    req.body.action = 'excuse';
  }
  return imageHandler(req, res);
}
