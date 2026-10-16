"use client";

export function DeleteButton({
  id,
  action,
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!confirm("Delete this record?")) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-sm font-medium text-rose-600 hover:text-rose-700">Delete</button>
    </form>
  );
}
