<template>
  <VRow>
    <VCol v-for="index in 4" :key="index" cols="12" sm="6" lg="3">
      <VSkeletonLoader type="article" />
    </VCol>
    <VCol cols="12">
      <VSkeletonLoader type="table-heading, table-thead, table-tbody" />
    </VCol>
  </VRow>
</template>
