AI Agent Operating Instructions
This project uses a structured workflow to ensure AI-assisted development remains reliable, maintainable, and predictable.

The AI agent (Gemini / Antigravity) should follow these rules when analyzing or modifying the codebase for Project Coordifit, an all-in-one fashion platform featuring a digital closet, coordination calendar, AI fitting service, and community snap features.

Project Goal
This repository contains a frontend application built from Figma Make generated code.

The objective is to:

Refactor the generated UI into a clean React architecture

Maintain the existing design

Implement UI interactions and state management using Zustand

Use mock services until backend APIs exist

Later connect real backend APIs with minimal UI changes

The AI should prioritize clean architecture and maintainability over quick hacks.

Architecture Principles
Separate UI from Logic
Follow this structure:

Plaintext
src/
components/
pages/
features/
services/
store/
hooks/
types/
utils/
styles/
Responsibilities
components/
Reusable UI elements (buttons, cards, panels, inputs).

pages/
Top-level screens (Dashboard, Workspace, Closet, Community, etc).

features/
Feature-specific components and logic.

services/
API calls and mock services.

store/
Global state management using Zustand.

hooks/
Reusable local state logic.

types/
TypeScript interfaces and types.

utils/
Generic helper functions.

styles/
Global styling or design tokens.

Component Rules
Components should follow these guidelines:

UI only

No direct API calls

Minimal state logic (delegate to store/ or hooks/)

Receive data via props

Be reusable when possible

Layout Conversion: Figma generates absolute positioning by default. The AI MUST convert absolute coordinates to responsive Flexbox or Grid layouts.

Business logic should live in:

Plaintext
hooks/
store/
services/
API Layer Rules
All API interactions must go through the services layer.

Example:

Plaintext
src/services/api/
Before backend APIs exist:

Plaintext
src/services/mock/
Example structure:

Plaintext
services/
api/
closetApi.ts
fittingApi.ts
mock/
closetMock.ts
fittingMock.ts
UI components must never directly call fetch or axios.

Mock-First Development
Since backend APIs are not yet available, development should follow a mock-first approach.

Mock services should:

simulate async requests

return realistic response shapes relevant to the fashion platform (e.g., clothing items, snap feeds)

match expected backend structures

Example:

TypeScript
export async function getClosetItemsMock() {
return {
items: [
{ id: "1", type: "top", color: "black", imageUrl: "..." },
]
}
}
When backend APIs become available, only the services layer should change.

Refactoring Guidelines
Figma Make generated files may contain:

very large components

mixed UI and logic

duplicated elements

rigid absolute positioning

The AI should:

Identify large files

Break them into smaller components

Move global logic into Zustand store/ and local logic into hooks/

Move API calls into services/

Convert absolute styles to Flexbox/Grid

Preserve UI visual appearance

Do NOT redesign UI unless explicitly requested.

TypeScript Rules
Always prefer strict typing.

Avoid:

any

Define types in:

Plaintext
src/types/
Example:

TypeScript
export interface ClothingItem {
id: string
category: "top" | "bottom" | "outer" | "shoes"
name: string
status: "available" | "in_laundry"
}
Development Workflow
When modifying code, the AI should follow this order:

Analyze existing code

Suggest structural improvements

Implement small changes

Preserve UI appearance

Ensure TypeScript correctness

Avoid massive one-shot rewrites.

Prefer incremental refactors.

File Organization
Example desired structure:

Plaintext
src/
components/
ui/
pages/
DigitalClosetPage.tsx
CalendarPage.tsx
features/
ai-fitting/
snap-feed/
services/
api/
mock/
store/
useUserStore.ts
useClosetStore.ts
hooks/
types/
utils/
styles/
Error Handling
All async logic should include:

loading state

error state

fallback UI

Example pattern:

TypeScript
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
Design Preservation
This project originates from Figma Make generated UI.

The AI should:

maintain layout

keep visual styling intact

avoid unnecessary style rewrites (except converting absolute to flex/grid)

prioritize structural improvements

Preferred Development Stack
The project uses:

React

Vite

TypeScript

React Router

Zustand (for global state management)

The AI should maintain compatibility with this stack.

General AI Behaviour
The AI agent should:

prefer existing utilities before creating new ones

keep code modular

avoid breaking existing UI

prioritize maintainability

If uncertain, the AI should ask for clarification rather than guessing.

Summary
This project follows a clean frontend architecture built on top of Figma-generated UI.

AI should:

refactor structure and remove absolute positioning

maintain visual design

isolate logic using Zustand and Hooks

implement mock APIs

prepare for backend integration
