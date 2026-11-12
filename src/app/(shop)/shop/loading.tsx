import { Bone, Loading, ProductGridSkeleton } from "@/components/skeletons";

export default function ShopLoading() {
  return (
    <Loading label="Loading products" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="border-b border-line pb-6">
        <Bone className="h-9 w-56" />
        <Bone className="mt-2 h-4 w-20" />
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <div className="hidden gap-3 lg:grid lg:h-fit">
          <Bone className="h-10 rounded-lg" />
          {Array.from({ length: 5 }, (_, i) => (
            <Bone key={i} className="h-5 w-32" />
          ))}
        </div>
        <ProductGridSkeleton count={8} />
      </div>
    </Loading>
  );
}
