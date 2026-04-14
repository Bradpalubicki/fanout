import type { FanoutClientContext, FanoutJobType, FanoutPlatform } from './types';

// Vertical-specific regulatory citation context for content generation
export const VERTICAL_CONTENT_CONTEXT: Record<string, string> = {
  appraiser: 'Reference USPAP SR 1-2(e), FHFA ROV Guidance 2024, 12 USC 3338 where relevant. Write for appraisers, not homeowners.',
  dental: 'Reference OSHA 29 CFR 1910.1030, HIPAA §164.520, EPA 40 CFR Part 441 where relevant. Write for practice owners.',
  transit: 'Reference 49 CFR Part 663, FTA Circular 4220.1F, 28 CFR Part 35 where relevant. Write for transit operators.',
  wellness: 'Reference FTC guidelines, state licensing regulations. Write for wellness practice operators.',
  legal: 'Reference state bar guidelines, ABA rules where relevant. Write for practice owners.',
  default: 'Reference industry-specific regulations and compliance standards where relevant.',
};

// Audit gap → content type mapping
export const AUDIT_GAP_CONTENT_MAP: Record<string, { type: FanoutJobType; description: string }> = {
  'Missing LocalBusiness schema':     { type: 'authority_cluster', description: 'Why local businesses need proper schema markup — educational series' },
  'No H1':                           { type: 'audit_gap_fill', description: 'What makes a strong homepage — content to support page rebuild' },
  'No meta description':             { type: 'audit_gap_fill', description: 'How search snippets affect click-through — authority post' },
  'Images missing alt text':         { type: 'compliance_education', description: 'ADA and accessibility for local businesses — compliance series' },
  'Form controls missing labels':    { type: 'compliance_education', description: 'WCAG 1.3.1 for professional service sites — compliance post' },
  'No CSP header':                   { type: 'compliance_education', description: 'Browser security for professional service businesses — trust post' },
  'No privacy policy':               { type: 'compliance_education', description: 'Privacy policy requirements for professional services' },
  'Weak CTA':                        { type: 'authority_cluster', description: 'How professional service sites convert — conversion content series' },
};

// Determine what type of content cluster to launch based on audit state
export function recommendFanoutStrategy(
  context: FanoutClientContext
): { type: FanoutJobType; reason: string; platforms: FanoutPlatform[] } {
  if (!context.auditScore || context.auditScore < 50) {
    return {
      type: 'authority_cluster',
      reason: 'Low audit score — launch 6-piece authority cluster to rebuild trust signals',
      platforms: ['linkedin', 'blog', 'twitter'],
    };
  }

  if (context.complianceRisk === 'high') {
    return {
      type: 'compliance_education',
      reason: 'High compliance risk — launch compliance education series to establish authority',
      platforms: ['linkedin', 'blog'],
    };
  }

  if (context.topIssues?.includes('Missing LocalBusiness schema') || context.topIssues?.includes('No H1')) {
    return {
      type: 'local_service_pages',
      reason: 'Missing local SEO signals — launch local service page support content',
      platforms: ['blog', 'linkedin'],
    };
  }

  // Default: standard content plan
  return {
    type: 'content_plan',
    reason: 'Standard recurring content plan for this vertical',
    platforms: ['linkedin', 'twitter', 'blog'],
  };
}
