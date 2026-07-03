import { api } from "@/lib/api";

/**
 * Mirrors the backend's `mountCrudExtensions` factory: adds archive/restore/
 * duplicate/bulk-* calls for a resource without hand-writing them per module.
 */
export function makeCrudExtensions<T>(resource: string, normalize: (raw: unknown) => T) {
  return {
    async archive(id: string): Promise<T> {
      const { data } = await api.patch(`/${resource}/${id}/archive`);
      return normalize(data.record);
    },
    async restore(id: string): Promise<T> {
      const { data } = await api.patch(`/${resource}/${id}/restore`);
      return normalize(data.record);
    },
    async duplicate(id: string): Promise<T> {
      const { data } = await api.post(`/${resource}/${id}/duplicate`);
      return normalize(data.record);
    },
    async bulkDelete(ids: string[]): Promise<number> {
      const { data } = await api.post(`/${resource}/bulk-delete`, { ids });
      return data.deletedCount as number;
    },
    async bulkArchive(ids: string[]): Promise<number> {
      const { data } = await api.post(`/${resource}/bulk-archive`, { ids });
      return data.modifiedCount as number;
    },
    async bulkRestore(ids: string[]): Promise<number> {
      const { data } = await api.post(`/${resource}/bulk-restore`, { ids });
      return data.modifiedCount as number;
    },
    async bulkUpdate(ids: string[], patch: Record<string, unknown>): Promise<number> {
      const { data } = await api.post(`/${resource}/bulk-update`, { ids, patch });
      return data.modifiedCount as number;
    },
  };
}
