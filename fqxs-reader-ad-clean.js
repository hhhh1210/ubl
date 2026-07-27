'use strict';

const response = typeof $response === 'object' && $response !== null ? $response : {};
const body = typeof response.body === 'string' ? response.body : '';

const removableKeys = new Set([
  'ad',
  'ads',
  'ad_data',
  'ad_context',
  'ad_info',
  'ad_infos',
  'ad_item',
  'ad_items',
  'ad_list',
  'ad_lists',
  'ad_material',
  'ad_materials',
  'ad_url_data',
  'advertisement',
  'advertisements',
  'activity_banner',
  'banner_ad',
  'banner_ads',
  'banner_data',
  'banner_info',
  'bottom_banner',
  'chapter_ad',
  'chapter_ad_card',
  'chapter_end_ad',
  'chapter_end_ad_card',
  'content_ad',
  'feed_ad',
  'feed_ads',
  'game_ad',
  'game_center_ad',
  'inspire_ad',
  'insert_ad',
  'insert_ad_rit_type',
  'interstitial_ad',
  'reader_ad',
  'reader_ads',
  'reader_banner',
  'reader_bottom_banner',
  'reading_ad',
  'reading_banner',
  'reward_ad',
  'ad_json',
  'marketing_banner',
  'operation_banner',
  'promotion_banner',
]);

const adTypePattern = /^(?:ad|ads|advertisement|chapter_ad|chapter_ad_card|chapter_end_ad|chapter_end_ad_card|content_ad|feed_ad|game_ad|game_center_ad|inspire_ad|insert_ad|interstitial_ad|reader_ad|reading_ad|reading_chapter_ad|reward_ad)$/i;
const strongAdIdentityKeyPattern = /^(?:ad_id|adid|ad_slot|ad_slot_id|non_std_ad_id)$/i;
const weakAdIdentityKeyPattern = /^(?:creative_id|rit|rit_id)$/i;
const adContextKeyPattern = /^(?:ad_type|ad_source|ad_position|ad_position_id|ad_platform|ad_scene|is_ad)$/i;
const disabledFlagPattern = /^(?:(?:is_|has_|show_|need_|enable_|preload_)?(?:ad|ads)(?:_|$)|(?:ad|ads)_(?:enable|enabled|show|visible|preload|loaded)|(?:feed|read|reader|reading|chapter|content|insert|interstitial|reward|inspire|video|splash)_ad_(?:enable|enabled|show|visible|preload)|(?:enable|show|need|preload|has|is)_(?:feed|read|reader|reading|chapter|content|insert|interstitial|reward|inspire|video|splash)_ad)$/i;
const removableConfigKeyPattern = /^(?:ad_available_config(?:_v\d+)?|ad_config|ad_new_loading_and_error_switch(?:_v\d+)?|ad_sticky_config|chapter_middle_ad_config|front_ad_inspire(?:_v\d+)?|gold_coin_patch_ad_config(?:_v\d+)?|inspire_dynamic_add_config|libra_ad_config|novel_ad_config|reader_front_ad_slide_config(?:_v\d+)?|reading_ad_lynx|reading_ad_ssr_optimize_config|reading_ad_title_config(?:_v\d+)?|insert_ad_rit_type)$/i;
const adModuleRoutePattern = /(?:\/\/(?:nonStandardAd|ad_lynx_aggregation)(?:[/?#&]|$)|drlynx_monetize_game)/i;
const promoPositionPattern = /(?:bottom|reader|reading|chapter[_-]?end)/i;
const promoContentKeyPattern = /(?:image|icon|title|desc|text|button|schema|url|link|close)/i;

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

function isAdModuleNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).some((item) => typeof item === 'string' && adModuleRoutePattern.test(item));
}

function isBottomPromoNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;

  const keys = Object.keys(value);
  const hasGenericBanner = keys.some((key) => /banner/i.test(key));
  const hasExplicitPromoName = keys.some((key) => /(?:bottom|activity|operation|marketing|promotion|campaign|reader.*banner)/i.test(key))
    || ['type', 'item_type', 'card_type', 'module_type', 'biz_type', 'scene']
      .map((key) => value[key])
      .some((item) => typeof item === 'string' && /(?:bottom|banner|activity|operation|marketing|promotion|campaign)/i.test(item));
  const position = ['position', 'slot', 'placement', 'scene', 'module_type', 'biz_type']
    .map((key) => value[key])
    .find((item) => typeof item === 'string' && promoPositionPattern.test(item));
  const hasVisualContent = keys.filter((key) => promoContentKeyPattern.test(key)).length >= 2;
  const hasDestination = keys.some((key) => /(?:schema|url|link|jump|open)/i.test(key));

  const hasCloseControl = keys.some((key) => /(?:close|closable|closeable)/i.test(key));

  return (hasExplicitPromoName || position || (hasGenericBanner && hasCloseControl)) && hasVisualContent && hasDestination;
}

function clean(value) {
  if (Array.isArray(value)) {
    const cleaned = [];
    for (const item of value) {
      if ((typeof item === 'string' && adModuleRoutePattern.test(item)) || isAdNode(item) || isAdModuleNode(item)) {
        removed += 1;
        continue;
      }
      if (isBottomPromoNode(item)) {
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

    if (removableKeys.has(normalized) || removableConfigKeyPattern.test(normalized)) {
      delete value[key];
      removed += 1;
      continue;
    }

    if ((typeof value[key] === 'string' && adModuleRoutePattern.test(value[key])) || isAdNode(value[key]) || isAdModuleNode(value[key]) || isBottomPromoNode(value[key])) {
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
