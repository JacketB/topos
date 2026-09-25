import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

window.addEventListener('keydown', (e) => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
    (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
  ) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
