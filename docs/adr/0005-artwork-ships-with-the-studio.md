# Jolene's artwork ships with the studio

Jolene's collections are code (`packages/suites`): each template is a design document, and the artwork it draws is a set of image files in `apps/studio/public/studio/art/<suite>/`, each named with a hash of its content. The studio serves them itself at `/studio/art/`, and Convex's `assets` table points at them by path instead of holding them in file storage. What couples upload, such as their photos, stays in Convex storage.

A file in the repository changes in the same commit and review as the templates that draw it, and reaches every deployment with the studio's build: previews, the welcome page (which draws the Forest invitation without the backend) and the template sheet (`packages/suites/preview`) all show the same files. Uploading them to each Convex deployment instead would need a script holding that deployment's admin key, which could fall out of step with the templates, and every preview deployment would keep its own copy.

Until Jolene's source files arrive, the artwork is lifted from the photos on jolene.ro (`packages/suites/lift`). A source file replaces a lifted one under the same asset key, and the templates don't change.

## Consequences

- A changed file gets a new name, so browsers keep each one for a year (`immutable`, in `apps/studio/next.config.ts`).
- Seeding (`init:seed`) records each suite's artwork by path and uploads nothing; seeding again brings every collection up to date.
- A path is relative to the studio's address, so anything that draws a design outside the studio, such as print files rendered on a server, resolves it against that address.
- The repository carries the images, a few megabytes of WebP per collection.
