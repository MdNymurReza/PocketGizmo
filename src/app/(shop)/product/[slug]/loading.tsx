import { Bone, Loading } from "@/components/skeletons";

export default function ProductLoading() {
  return (
    <Loading label="Loading product" className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Bone className="h-4 w-48" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-16">
        <Bone className="aspect-square rounded-2xl" />
        <div className="grid h-fit gap-4">
          <Bone className="h-4 w-24" />
          <Bone className="h-9 w-3/4" />
          <Bone className="h-7 w-32" />
          <Bone className="mt-4 h-4 w-20" />
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <Bone key={i} className="h-10 w-20 rounded-lg" />
            ))}
          </div>
          <Bone className="mt-4 h-12 rounded-lg" />
          <Bone className="h-12 rounded-lg" />
        </div>
      </div>
    </Loading>
  );
}
