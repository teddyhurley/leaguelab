import { runExperiment } from './engine.js';
self.onmessage = ({ data: { id, config } }) => {
  try { const result = runExperiment(config, (progress, message) => self.postMessage({ id, type: 'progress', progress, message })); self.postMessage({ id, type: 'result', result }); }
  catch (error) { self.postMessage({ id, type: 'error', message: error.message || 'The simulation could not finish.' }); }
};
