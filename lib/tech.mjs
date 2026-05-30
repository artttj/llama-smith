export const BRAND = {
  // JS/TS frameworks & meta-frameworks
  Expo: ['expo', '000020'], 'React Native': ['react', '61DAFB'], 'Next.js': ['nextdotjs', '000000'], Nuxt: ['nuxtdotjs', '00DC82'],
  Remix: ['remix', '000000'], Astro: ['astro', 'BC52EE'], SvelteKit: ['svelte', 'FF3E00'], Svelte: ['svelte', 'FF3E00'],
  Vue: ['vuedotjs', '4FC08D'], Angular: ['angular', 'DD0031'], Solid: ['solid', '2C4F7C'], Qwik: ['qwik', 'AC7EF4'],
  Gatsby: ['gatsby', '663399'], Ember: ['emberdotjs', 'E04E39'], Preact: ['preact', '673AB8'], React: ['react', '61DAFB'],
  Electron: ['electron', '47848F'], Tauri: ['tauri', 'FFC131'], Ionic: ['ionic', '3880FF'], Capacitor: ['capacitor', '119EFF'],
  // JS backend
  NestJS: ['nestjs', 'E0234E'], Express: ['express', '000000'], Fastify: ['fastify', '000000'], Koa: ['koa', '33333D'],
  Hono: ['hono', 'E36002'], AdonisJS: ['adonisjs', '5A45FF'], 'Nuxt Nitro': ['nitro', '00DC82'], tRPC: ['trpc', '2596BE'], Apollo: ['apollographql', '311C87'], GraphQL: ['graphql', 'E10098'],
  // JS build/test/tooling
  Vite: ['vite', '646CFF'], Webpack: ['webpack', '8DD6F9'], Turborepo: ['turborepo', 'EF4444'], Nx: ['nx', '143055'],
  Jest: ['jest', 'C21325'], Vitest: ['vitest', '6E9F18'], Playwright: ['', '2EAD33'], Cypress: ['cypress', '69D3A7'], Storybook: ['storybook', 'FF4785'],
  'Tailwind CSS': ['tailwindcss', '06B6D4'], Redux: ['redux', '764ABC'], Zustand: ['', '443E38'],
  // ORMs / data clients
  Prisma: ['prisma', '2D3748'], Drizzle: ['drizzle', 'C5F74F'], TypeORM: ['', 'FE0803'], Sequelize: ['sequelize', '52B0E7'], Mongoose: ['mongoose', '880000'],
  Supabase: ['supabase', '3FCF8E'], Firebase: ['firebase', 'DD2C00'],
  // PHP
  Laravel: ['laravel', 'FF2D20'], Symfony: ['symfony', '000000'], WordPress: ['wordpress', '21759B'], Drupal: ['drupal', '0678BE'], CodeIgniter: ['codeigniter', 'EF4223'], Slim: ['slim', 'cocb2e'],
  // Python
  Django: ['django', '092E20'], Flask: ['flask', '000000'], FastAPI: ['fastapi', '009688'], Starlette: ['', '009688'], Tornado: ['', '000000'], Celery: ['celery', '37814A'], SQLAlchemy: ['sqlalchemy', 'D71F00'], Pydantic: ['pydantic', 'E92063'],
  // Ruby
  Rails: ['rubyonrails', 'D30001'], Sinatra: ['', '000000'],
  // Go
  Gin: ['gin', '008ECF'], Echo: ['', '00ADD8'], Fiber: ['', '00ADD8'], Chi: ['', '00ADD8'],
  // Rust
  Actix: ['', '000000'], Axum: ['', 'CE412B'], Rocket: ['', 'D33847'], Warp: ['', '000000'],
  // JVM
  'Spring Boot': ['springboot', '6DB33F'], Spring: ['spring', '6DB33F'], Quarkus: ['quarkus', '4695EB'], Micronaut: ['', '00b3a4'], Ktor: ['ktor', '087CFA'], Android: ['android', '34A853'],
  // .NET
  'ASP.NET': ['dotnet', '512BD4'], Blazor: ['blazor', '512BD4'], '.NET': ['dotnet', '512BD4'],
  // Mobile/other
  Flutter: ['flutter', '02569B'], SwiftUI: ['swift', 'F05138'],
  // Languages & runtimes
  Node: ['nodedotjs', '5FA04E'], Deno: ['deno', '70FFAF'], Bun: ['bun', '000000'], TypeScript: ['typescript', '3178C6'],
  PHP: ['php', '777BB4'], Python: ['python', '3776AB'], Go: ['go', '00ADD8'], Rust: ['rust', '000000'], Ruby: ['ruby', 'CC342D'],
  Java: ['openjdk', '437291'], Kotlin: ['kotlin', '7F52FF'], 'C#': ['csharp', '512BD4'], Dart: ['dart', '0175C2'], Swift: ['swift', 'F05138'], Elixir: ['elixir', '4B275F'],
  // Package managers
  pnpm: ['pnpm', 'F69220'], Yarn: ['yarn', '2C8EBB'], npm: ['npm', 'CB3837'], Composer: ['composer', '885630'], Poetry: ['poetry', '60A5FA'], uv: ['uv', 'DE5FE9'], Cargo: ['rust', '000000'], Bundler: ['rubygems', 'E9573F'], Maven: ['apachemaven', 'C71A36'], Gradle: ['gradle', '02303A'],
  // Infra
  Docker: ['docker', '2496ED'], Kubernetes: ['kubernetes', '326CE5'], Terraform: ['terraform', '7B42BC'], 'GitHub Actions': ['githubactions', '2088FF'], Vercel: ['vercel', '000000'], Netlify: ['netlify', '00C7B7'],
}

export const JS_DEPS = {
  expo: 'Expo', 'react-native': 'React Native', next: 'Next.js', nuxt: 'Nuxt', '@remix-run/react': 'Remix', astro: 'Astro',
  '@sveltejs/kit': 'SvelteKit', svelte: 'Svelte', vue: 'Vue', '@angular/core': 'Angular', 'solid-js': 'Solid', '@builder.io/qwik': 'Qwik',
  gatsby: 'Gatsby', 'ember-source': 'Ember', preact: 'Preact', react: 'React', electron: 'Electron', '@tauri-apps/api': 'Tauri',
  '@ionic/react': 'Ionic', '@ionic/angular': 'Ionic', '@capacitor/core': 'Capacitor',
  '@nestjs/core': 'NestJS', express: 'Express', fastify: 'Fastify', koa: 'Koa', hono: 'Hono', '@adonisjs/core': 'AdonisJS',
  '@trpc/server': 'tRPC', '@apollo/server': 'Apollo', 'apollo-server': 'Apollo', graphql: 'GraphQL',
  vite: 'Vite', webpack: 'Webpack', turbo: 'Turborepo', nx: 'Nx', jest: 'Jest', vitest: 'Vitest', '@playwright/test': 'Playwright', cypress: 'Cypress', storybook: 'Storybook', '@storybook/react': 'Storybook',
  tailwindcss: 'Tailwind CSS', redux: 'Redux', '@reduxjs/toolkit': 'Redux', zustand: 'Zustand',
  prisma: 'Prisma', '@prisma/client': 'Prisma', 'drizzle-orm': 'Drizzle', typeorm: 'TypeORM', sequelize: 'Sequelize', mongoose: 'Mongoose',
  '@supabase/supabase-js': 'Supabase', firebase: 'Firebase', 'firebase-admin': 'Firebase',
}
export const PHP_DEPS = {
  'laravel/framework': 'Laravel', 'symfony/symfony': 'Symfony', 'symfony/framework-bundle': 'Symfony',
  'johnpbloch/wordpress-core': 'WordPress', 'drupal/core': 'Drupal', 'codeigniter4/framework': 'CodeIgniter', 'slim/slim': 'Slim',
}
export const PY_DEPS = [[/\bdjango\b/i, 'Django'], [/\bflask\b/i, 'Flask'], [/\bfastapi\b/i, 'FastAPI'], [/\bstarlette\b/i, 'Starlette'], [/\btornado\b/i, 'Tornado'], [/\bcelery\b/i, 'Celery'], [/\bsqlalchemy\b/i, 'SQLAlchemy'], [/\bpydantic\b/i, 'Pydantic']]
export const GO_DEPS = [[/gin-gonic\/gin/, 'Gin'], [/labstack\/echo/, 'Echo'], [/gofiber\/fiber/, 'Fiber'], [/go-chi\/chi/, 'Chi']]
export const RUST_DEPS = [[/^\s*actix-web\b/m, 'Actix'], [/^\s*axum\b/m, 'Axum'], [/^\s*rocket\b/m, 'Rocket'], [/^\s*warp\b/m, 'Warp'], [/^\s*tauri\b/m, 'Tauri']]
export const RUBY_DEPS = [[/['"]rails['"]/, 'Rails'], [/['"]sinatra['"]/, 'Sinatra']]
export const JVM_DEPS = [[/spring-boot/, 'Spring Boot'], [/springframework/, 'Spring'], [/quarkus/, 'Quarkus'], [/micronaut/, 'Micronaut'], [/io\.ktor/, 'Ktor']]
export const DOTNET_DEPS = [[/Microsoft\.AspNetCore/i, 'ASP.NET'], [/Microsoft\.AspNetCore\.Components|Blazor/i, 'Blazor']]

// tier, not tooling (Vite/Jest), ORMs, languages, or package managers.
export const FRAMEWORK_LABELS = new Set([
  'Expo', 'React Native', 'Next.js', 'Nuxt', 'Remix', 'Astro', 'SvelteKit', 'Svelte', 'Vue', 'Angular', 'Solid', 'Qwik', 'Gatsby', 'Ember', 'Preact', 'React',
  'Electron', 'Tauri', 'Ionic', 'NestJS', 'Express', 'Fastify', 'Koa', 'Hono', 'AdonisJS',
  'Laravel', 'Symfony', 'WordPress', 'Drupal', 'CodeIgniter', 'Slim', 'Django', 'Flask', 'FastAPI', 'Starlette', 'Tornado',
  'Rails', 'Sinatra', 'Gin', 'Echo', 'Fiber', 'Chi', 'Actix', 'Axum', 'Rocket', 'Warp',
  'Spring Boot', 'Spring', 'Quarkus', 'Micronaut', 'Ktor', 'ASP.NET', 'Blazor', 'Flutter', 'SwiftUI',
])
