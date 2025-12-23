# FlowPost Tests

This directory contains all tests for the FlowPost application.

## Directory Structure

```
tests/
├── backend/           # Backend unit tests (Jest)
│   └── date.test.ts   # Date utility tests
├── frontend/          # Frontend unit tests (Jest + React Testing Library)
│   ├── utils.test.ts  # Utility function tests
│   └── button.test.tsx # Component tests
├── e2e/               # End-to-end tests (Playwright)
│   ├── home.spec.ts   # Home page tests
│   └── dashboard.spec.ts # Dashboard tests
└── README.md
```

## Running Tests

### Backend Tests

```bash
# From project root
yarn test                    # Run all backend tests
yarn test:watch              # Watch mode
yarn test:coverage           # With coverage report
```

### Frontend Tests

```bash
# From frontend directory
cd frontend
pnpm test                    # Run all frontend tests
pnpm test:watch              # Watch mode
pnpm test:coverage           # With coverage report
```

### E2E Tests

```bash
# From project root
yarn test:e2e                # Run all E2E tests
yarn test:e2e:ui             # Run with Playwright UI
```

## Test Frameworks

| Type     | Framework                    | Configuration             |
| -------- | ---------------------------- | ------------------------- |
| Backend  | Jest + ts-jest               | `jest.config.js` (root)   |
| Frontend | Jest + React Testing Library | `frontend/jest.config.js` |
| E2E      | Playwright                   | `playwright.config.ts`    |

## Writing Tests

### Backend Test Example

```typescript
// tests/backend/example.test.ts
import { myFunction } from "../../backend/utils/example.js";

describe("myFunction", () => {
  it("should do something", () => {
    expect(myFunction()).toBe(expectedValue);
  });
});
```

### Frontend Test Example

```typescript
// tests/frontend/component.test.tsx
import { render, screen } from "@testing-library/react";
import { MyComponent } from "@/components/my-component";

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
// tests/e2e/feature.spec.ts
import { test, expect } from "@playwright/test";

test("user can complete flow", async ({ page }) => {
  await page.goto("/");
  await page.click("text=Sign In");
  await expect(page).toHaveURL(/sign-in/);
});
```

## Coverage Reports

Coverage reports are generated in:

- Backend: `coverage/backend/`
- Frontend: `coverage/frontend/`

View HTML reports by opening `index.html` in the respective coverage directories.

## CI/CD Integration

Tests run automatically on:

- Every push to `main` branch
- Every pull request
- Can be triggered manually via GitHub Actions
