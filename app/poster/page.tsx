import type { Metadata } from "next";
import Poster from "@/components/poster/Poster";

export const metadata: Metadata = {
  title: "Poster · Records",
  description: "The collection's covers sorted by color, ready to print",
};

export default function PosterPage() {
  return <Poster />;
}
