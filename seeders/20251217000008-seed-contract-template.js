'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const templates = [
      {
        id: uuidv4(),
        name: 'Standard Collaboration Agreement',
        description: 'Default contract template for brand-creator collaborations',
        content: `# COLLABORATION AGREEMENT

This Collaboration Agreement ("Agreement") is entered into as of {{contract_date}} between:

**BRAND ("Client"):**
- Company Name: {{brand_company_name}}
- Contact Person: {{brand_contact_name}}
- Email: {{brand_email}}

**CREATOR ("Service Provider"):**
- Name: {{creator_display_name}}
- Email: {{creator_email}}

## 1. SCOPE OF WORK

The Creator agrees to provide the following services:

{{services_list}}

**Campaign Details:**
- Campaign Name: {{campaign_title}}
- Campaign Brief: {{campaign_brief}}
- Required Hashtags: {{hashtags}}
- Mentions: {{mentions}}

## 2. DELIVERABLES AND TIMELINE

**Content Deliverables:**
{{deliverables_list}}

**Timeline:**
- Start Date: {{start_date}}
- Content Submission Deadline: {{submission_deadline}}
- Posting Date(s): {{posting_dates}}
- End Date: {{end_date}}

## 3. COMPENSATION

**Total Compensation:** ₦{{total_amount}}

**Payment Terms:**
- Payment will be held in escrow by CreatorsWorld upon contract signing
- Payment will be released to Creator upon Brand approval of deliverables
- Platform commission ({{commission_rate}}%) will be deducted from total amount

## 4. CONTENT APPROVAL

- Creator will submit content for Brand review before posting
- Brand will have {{revision_count}} revision request(s)
- Brand must approve or request revisions within {{approval_days}} business days
- Failure to respond within the approval window constitutes automatic approval

## 5. USAGE RIGHTS

{{usage_rights_clause}}

**Usage Period:** {{usage_period}}

## 6. EXCLUSIVITY

{{exclusivity_clause}}

## 7. DISCLOSURE AND COMPLIANCE

- Creator agrees to comply with ARCON (Advertising Regulatory Council of Nigeria) guidelines
- All sponsored content must include appropriate disclosure (e.g., #Ad, #Sponsored, #Paid)
- Creator is responsible for ensuring content complies with platform-specific guidelines

## 8. INTELLECTUAL PROPERTY

- Creator retains ownership of original creative concepts
- Brand owns final approved content for the specified usage period
- Creator may display content in portfolio with Brand attribution

## 9. CONFIDENTIALITY

Both parties agree to keep confidential any proprietary information shared during the collaboration, including but not limited to:
- Campaign strategies and briefs
- Unreleased products or services
- Pricing and business terms

## 10. CANCELLATION

**By Brand:**
- Cancellation before content creation: Full refund minus 10% admin fee
- Cancellation after content creation begins: 50% of total amount due to Creator
- Cancellation after content submission: Full payment due to Creator

**By Creator:**
- Cancellation before start date: No penalty
- Cancellation after start date: Creator forfeits payment and may be subject to account review

## 11. DISPUTE RESOLUTION

Any disputes arising from this Agreement will be resolved through:
1. Direct negotiation between parties
2. Mediation through CreatorsWorld platform
3. Binding arbitration under Nigerian law

## 12. LIMITATION OF LIABILITY

CreatorsWorld acts as a facilitator and is not liable for:
- Quality or performance of services
- Content posted by Creator
- Results or ROI of campaigns

## 13. GOVERNING LAW

This Agreement shall be governed by the laws of the Federal Republic of Nigeria.

## 14. ENTIRE AGREEMENT

This Agreement, including any attachments, constitutes the entire agreement between the parties.

---

**SIGNATURES**

**Brand Representative:**
Signature: {{brand_signature}}
Name: {{brand_contact_name}}
Date: {{brand_signed_date}}

**Creator:**
Signature: {{creator_signature}}
Name: {{creator_display_name}}
Date: {{creator_signed_date}}

---

*This contract was generated and executed through CreatorsWorld platform.*
*Contract ID: {{contract_id}}*
*Generated on: {{generated_date}}*`,
        variables: JSON.stringify([
          'contract_date', 'brand_company_name', 'brand_contact_name', 'brand_email',
          'creator_display_name', 'creator_email', 'services_list', 'campaign_title',
          'campaign_brief', 'hashtags', 'mentions', 'deliverables_list', 'start_date',
          'submission_deadline', 'posting_dates', 'end_date', 'total_amount',
          'commission_rate', 'revision_count', 'approval_days', 'usage_rights_clause',
          'usage_period', 'exclusivity_clause', 'brand_signature', 'brand_signed_date',
          'creator_signature', 'creator_signed_date', 'contract_id', 'generated_date'
        ]),
        version: 1,
        isDefault: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        name: 'Quick Collaboration Agreement',
        description: 'Simplified contract for smaller collaborations under ₦50,000',
        content: `# QUICK COLLABORATION AGREEMENT

**Date:** {{contract_date}}

## PARTIES

**Brand:** {{brand_company_name}} ({{brand_email}})
**Creator:** {{creator_display_name}} ({{creator_email}})

## WORK SUMMARY

{{services_list}}

**Campaign:** {{campaign_title}}
**Brief:** {{campaign_brief}}

## TIMELINE

- Submission Deadline: {{submission_deadline}}
- Posting Date: {{posting_dates}}

## PAYMENT

**Amount:** ₦{{total_amount}} (Platform fee: {{commission_rate}}%)

Payment held in escrow and released upon content approval.

## TERMS

1. Creator will include required disclosures (#Ad, #Sponsored)
2. Brand has {{revision_count}} revision request(s)
3. Content must comply with ARCON guidelines
4. Standard CreatorsWorld terms apply

## SIGNATURES

**Brand:** {{brand_signature}} ({{brand_signed_date}})
**Creator:** {{creator_signature}} ({{creator_signed_date}})

---
*Contract ID: {{contract_id}} | CreatorsWorld*`,
        variables: JSON.stringify([
          'contract_date', 'brand_company_name', 'brand_email', 'creator_display_name',
          'creator_email', 'services_list', 'campaign_title', 'campaign_brief',
          'submission_deadline', 'posting_dates', 'total_amount', 'commission_rate',
          'revision_count', 'brand_signature', 'brand_signed_date', 'creator_signature',
          'creator_signed_date', 'contract_id'
        ]),
        version: 1,
        isDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('ContractTemplates', templates, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('ContractTemplates', null, {});
  }
};
