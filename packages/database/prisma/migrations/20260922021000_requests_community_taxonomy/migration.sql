-- Community taxonomy branch of the shared Requests taxonomy.
-- Community subcategories carry no sport: a person who lost a wallet, needs local
-- advice or wants community help must never be forced to pick a sport first.
-- Every leaf that cannot predict the requester's exact need carries an `Other`
-- escape hatch with allowsCustomText = true.
-- Community needs are COMMUNITY_SUPPORT, so they can never surface in Donations
-- (Donations stays PRODUCT-only) and they are seeded on the REQUESTS surface only.

INSERT INTO "HelpTaxonomySubcategory"
  ("id", "requestType", "sport", "slug", "label", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('hts-community-lost-found', 'COMMUNITY'::"HelpRequestType", NULL, 'lost-found', 'Lost & Found', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-questions-advice', 'COMMUNITY'::"HelpRequestType", NULL, 'questions-advice', 'Questions & Advice', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-people-needs', 'COMMUNITY'::"HelpRequestType", NULL, 'people-needs', 'Personal & People Needs', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-local-help', 'COMMUNITY'::"HelpRequestType", NULL, 'local-help', 'Local Help & Services', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-community-activities', 'COMMUNITY'::"HelpRequestType", NULL, 'community-activities', 'Community Activities', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-borrow-share', 'COMMUNITY'::"HelpRequestType", NULL, 'borrow-share', 'Borrow & Share', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('hts-community-community-notice', 'COMMUNITY'::"HelpRequestType", NULL, 'community-notice', 'Information & Notice', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "HelpTaxonomyNeed"
  ("id", "subcategoryId", "slug", "label", "kind", "allowsCustomText", "sortOrder", "active", "createdAt", "updatedAt")
VALUES
  ('htn-community-lost-found-lost-item', 'hts-community-lost-found', 'lost-item', 'Lost Item', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-lost-found-found-item', 'hts-community-lost-found', 'found-item', 'Found Item', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-lost-found-lost-pet', 'hts-community-lost-found', 'lost-pet', 'Lost Pet', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-lost-found-other', 'hts-community-lost-found', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-questions-advice-question', 'hts-community-questions-advice', 'question', 'I Have a Question', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-questions-advice-local-recommendation', 'hts-community-questions-advice', 'local-recommendation', 'Local Recommendation', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-questions-advice-advice-needed', 'hts-community-questions-advice', 'advice-needed', 'Advice Needed', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-questions-advice-how-do-i', 'hts-community-questions-advice', 'how-do-i', 'How Do I...?', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-questions-advice-other', 'hts-community-questions-advice', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-people-needs-helping-hand', 'hts-community-people-needs', 'helping-hand', 'A Helping Hand', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-people-needs-someone-for-task', 'hts-community-people-needs', 'someone-for-task', 'Someone for a Task', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-people-needs-local-person-or-service', 'hts-community-people-needs', 'local-person-or-service', 'Local Person or Service', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-people-needs-volunteer-help', 'hts-community-people-needs', 'volunteer-help', 'Volunteer Help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-people-needs-other', 'hts-community-people-needs', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-local-help-transportation-help', 'hts-community-local-help', 'transportation-help', 'Transportation Help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-local-help-moving-help', 'hts-community-local-help', 'moving-help', 'Moving & Carrying Help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-local-help-repair-help', 'hts-community-local-help', 'repair-help', 'Repair & Maintenance Help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-local-help-errand-help', 'hts-community-local-help', 'errand-help', 'Errand Help', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-local-help-other', 'hts-community-local-help', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-activities-people-to-join', 'hts-community-community-activities', 'people-to-join', 'People to Join', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-activities-organising-activity', 'hts-community-community-activities', 'organising-activity', 'Organising an Activity', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-activities-volunteer-opportunity', 'hts-community-community-activities', 'volunteer-opportunity', 'Volunteer Opportunity', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-activities-community-meetup', 'hts-community-community-activities', 'community-meetup', 'Community Meetup', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-activities-other', 'hts-community-community-activities', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-borrow-share-need-to-borrow', 'hts-community-borrow-share', 'need-to-borrow', 'Need to Borrow Something', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-borrow-share-have-to-lend', 'hts-community-borrow-share', 'have-to-lend', 'Have Something to Lend', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-borrow-share-need-equipment', 'hts-community-borrow-share', 'need-equipment', 'Need Equipment', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-borrow-share-other', 'hts-community-borrow-share', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-notice-local-information', 'hts-community-community-notice', 'local-information', 'Local Information Needed', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-notice-community-notice', 'hts-community-community-notice', 'community-notice', 'Community Notice', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-notice-recommendation-wanted', 'hts-community-community-notice', 'recommendation-wanted', 'Recommendation Wanted', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", false, 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('htn-community-community-notice-other', 'hts-community-community-notice', 'other', 'Other', 'COMMUNITY_SUPPORT'::"HelpTaxonomyNeedKind", true, 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "HelpTaxonomyNeedSurface" ("needId", "surface")
VALUES
  ('htn-community-lost-found-lost-item', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-lost-found-found-item', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-lost-found-lost-pet', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-lost-found-other', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-questions-advice-question', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-questions-advice-local-recommendation', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-questions-advice-advice-needed', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-questions-advice-how-do-i', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-questions-advice-other', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-people-needs-helping-hand', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-people-needs-someone-for-task', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-people-needs-local-person-or-service', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-people-needs-volunteer-help', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-people-needs-other', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-local-help-transportation-help', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-local-help-moving-help', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-local-help-repair-help', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-local-help-errand-help', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-local-help-other', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-activities-people-to-join', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-activities-organising-activity', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-activities-volunteer-opportunity', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-activities-community-meetup', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-activities-other', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-borrow-share-need-to-borrow', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-borrow-share-have-to-lend', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-borrow-share-need-equipment', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-borrow-share-other', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-notice-local-information', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-notice-community-notice', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-notice-recommendation-wanted', 'REQUESTS'::"HelpTaxonomySurface"),
  ('htn-community-community-notice-other', 'REQUESTS'::"HelpTaxonomySurface");
