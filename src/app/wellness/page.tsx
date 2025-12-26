'use client'

import * as React from 'react'
import { Header } from '@/components/layout/header'
import { PageContainer, Section } from '@/components/layout/page-container'
import { WellnessSummary } from '@/components/wellness/wellness-summary'

export default function WellnessPage() {
  return (
    <>
      <Header title="Bien-etre" showBack />

      <PageContainer>
        <Section>
          <WellnessSummary />
        </Section>
      </PageContainer>
    </>
  )
}
