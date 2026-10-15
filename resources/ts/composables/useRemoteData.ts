import { getErrorMessage } from "@/utils/errors"

export const useRemoteData = <T>(loader: () => Promise<{ data: T }>, initialValue: T) => {
  const data = ref<T>(initialValue) as Ref<T>
  const loading = ref(true)
  const error = ref("")

  const load = async () => {
    loading.value = true
    error.value = ""
    try {
      const response = await loader()

      data.value = response.data
    } catch (caught) {
      error.value = getErrorMessage(caught)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return { data, loading, error, load }
}
