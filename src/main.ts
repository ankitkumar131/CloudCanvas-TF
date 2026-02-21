import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/layout/app.component';

bootstrapApplication(AppComponent).catch((error: unknown) => {
  console.error('Failed to bootstrap CloudCanvas-TF:', error);
});
