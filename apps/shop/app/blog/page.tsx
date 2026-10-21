import type { Metadata } from "next";

import { PostCard } from "@/components/blog/post-card";
import { Container } from "@/components/ui/container";
import { Page } from "@/components/ui/page";
import { Sections } from "@/components/ui/sections";
import { BLOG_PATH } from "@/lib/blog";
import { getPosts } from "@/lib/blog/server";
import { buildAlternates, buildOpenGraph } from "@/lib/seo";

const TITLE = "Blog";
const DESCRIPTION =
  "Texte, idei și sfaturi pentru invitațiile de nuntă și botez, mărturii și decorul nunții.";

export const metadata: Metadata = {
  alternates: buildAlternates({ pathname: BLOG_PATH }),
  description: DESCRIPTION,
  openGraph: buildOpenGraph({
    description: DESCRIPTION,
    title: TITLE,
    type: "website",
    url: BLOG_PATH,
  }),
  title: TITLE,
};

export default function BlogPage() {
  return (
    <Page className="pt-2.5 md:pt-10">
      <Container>
        <Sections>
          <header className="grid gap-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl">{TITLE}</h1>
            <p className="max-w-2xl text-muted-foreground">{DESCRIPTION}</p>
          </header>
          <ul className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {getPosts().map((post, index) => (
              <li key={post.slug}>
                <PostCard loading={index < 3 ? "eager" : "lazy"} post={post} />
              </li>
            ))}
          </ul>
        </Sections>
      </Container>
    </Page>
  );
}
