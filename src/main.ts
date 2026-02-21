import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <main class="app-shell">
      <h1>CloudCanvas-TF</h1>
      <p>Angular project structure scaffolded for visual GCP-to-Terraform builder.</p>
    </main>
  `,
  styles: [
    `
      .app-shell {
        padding: 2rem;
        font-family: Inter, system-ui, sans-serif;
      }
    `,
  ],
})
class AppComponent {}

bootstrapApplication(AppComponent, {
  providers: [provideRouter([])],
}).catch((error: unknown) => {
  console.error(error);
});
