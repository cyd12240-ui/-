process.on('uncaughtException', e => console.error('[CRASH]', e.message, e.stack));
process.on('unhandledRejection', r => console.error('[CRASH] R:', r));
