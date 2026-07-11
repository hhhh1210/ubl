'use strict';

const response = typeof $response === 'object' && $response !== null ? $response : {};
const body = typeof response.body === 'string' ? response.body : '';

const removableKeys = new Set([
  'ad',
  'ads',
  'ad_data',
  'ad_info',
  'ad_infos',
  'ad_item',
  'ad_items',
  'ad_list',
  'ad_lists',
  'ad_material',
  'ad_materials',
  'advertisement',
  'advertisements',
  'chapter_ad',
  'chapter_ad_card',
  'chapter_end_ad',
  'chapter_end_ad_card',
  'content_ad',
  'feed_ad',
  'feed_ads',
  'game_center_ad',
  'inspire_ad',
  'insert_ad',
  'interstitial_ad',
  'reader_ad',
  'reader_ads',
  'reading_ad',
  'reward_ad',
]);

const adTypePattern = /^(?:ad|ads|advertisement|chapter_ad|chapter_ad_card|chapter_end_ad|chapter_end_ad_card|content_ad|feed_ad|game_center_ad|inspire_ad|insert_ad|interstitial_ad|reader_ad|reading_ad|reading_chapter_ad|reward_ad)$/i;
const strongAdIdentityKeyPattern = /^(?:ad_id|adid|ad_info|ad_data|ad_material|ad_slot|ad_slot_id)$/i;
const weakAdIdentityKeyPattern = /^(?:creative_id|rit|rit_id)$/i;
const adContextKeyPattern = /^(?:ad_type|ad_source|ad_position|ad_position_id|ad_platform|ad_scene|is_ad)$/i;
const disabledFlagPattern = /^(?:(?:is_|has_|show_|need_|enable_|preload_)?(?:ad|ads)(?:_|$)|(?:ad|ads)_(?:enable|enabled|show|visible|preload|loaded)|(?:feed|read|reader|reading|chapter|content|insert|interstitial|reward|inspire|video|splash)_ad_(?:enable|enabled|show|visible|preload))$/i;

let removed = 0;
let disabled = 0;

function isAdNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const keys = Object.keys(value);
  if (keys.some((key) => strongAdIdentityKeyPattern.test(key))) return true;
  if (keys.some((key) => weakAdIdentityKeyPattern.test(key)) && keys.some((key) => adContextKeyPattern.test(key))) return true;

  for (const key of ['type', 'item_type', 'card_type', 'data_type', 'biz_type', 'module_type', 'cell_type', 'scene']) {
    if (typeof value[key] === 'string' && adTypePattern.test(value[key])) return true;
  }

  return value.is_ad === true || value.is_ad === 1 || value.is_ad === '1';
}

function clean(value) {
  if (Array.isArray(value)) {
    const cleaned = [];
    for (const item of value) {
      if (isAdNode(item)) {
        removed += 1;
        continue;
      }
      cleaned.push(clean(item));
    }
    return cleaned;
  }

  if (!value || typeof value !== 'object') return value;

  for (const key of Object.keys(value)) {
    const normalized = key.toLowerCase();

    if (removableKeys.has(normalized)) {
      delete value[key];
      removed += 1;
      continue;
    }

    if (disabledFlagPattern.test(normalized) && (typeof value[key] === 'boolean' || value[key] === 0 || value[key] === 1 || value[key] === '0' || value[key] === '1')) {
      value[key] = typeof value[key] === 'string' ? '0' : (typeof value[key] === 'number' ? 0 : false);
      disabled += 1;
      continue;
    }

    value[key] = clean(value[key]);
  }

  return value;
}

try {
  if (!body) {
    $done({});
  } else {
    const json = JSON.parse(body);
    const cleaned = clean(json);
    if (removed || disabled) {
      console.log(`FQXS reader ad clean: removed=${removed}, disabled=${disabled}`);
      $done({ body: JSON.stringify(cleaned) });
    } else {
      $done({});
    }
  }
} catch (error) {
  $done({});
}
