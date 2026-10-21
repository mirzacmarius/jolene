import { getBrowseSource } from "@/lib/categories";
import { getBrowseResults, getCategory } from "@/lib/categories/server";
import { categoryToMarkdown } from "@/lib/markdown/category";
import { notFoundMarkdown } from "@/lib/markdown/not-found";
import { markdownHeaders } from "@/lib/markdown/representation";

// Opts the handler into the stored-output model; every handle renders on demand and is kept until its tag is invalidated.
export function generateStaticParams(): Array<{ handle: string }> {
  return [];
}

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const pathname = `/collections/${handle}`;
  try {
    const category = await getCategory(handle);
    if (!category) {
      return new Response(notFoundMarkdown({ kind: "Category", value: handle }), {
        headers: markdownHeaders({
          cacheControl: "public, max-age=3600, stale-while-revalidate=604800",
          pathname,
        }),
        status: 404,
      });
    }
    const results = await getBrowseResults({ sort: "manual", source: getBrowseSource(handle) });
    return new Response(categoryToMarkdown(category, results), {
      headers: markdownHeaders({
        cacheControl: "public, max-age=86400, stale-while-revalidate=604800",
        pathname,
      }),
    });
  } catch {
    return new Response(
      "# Server Error\n\nAn error occurred while retrieving the category. Please try again later.",
      {
        headers: markdownHeaders({
          cacheControl: "no-cache, no-store, must-revalidate",
          pathname,
        }),
        status: 500,
      },
    );
  }
}
