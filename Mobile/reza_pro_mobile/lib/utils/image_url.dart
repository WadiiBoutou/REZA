import 'dart:convert';

import 'package:flutter/material.dart';

import '../config/api_config.dart';

/// Resolves an image/avatar string into a fetchable absolute URL:
/// - absolute http(s) URLs pass through untouched;
/// - localhost / 127.0.0.1 URLs (stale dev data) are rewritten to the current
///   API origin so a real phone doesn't try to reach ITSELF;
/// - relative paths (`/uploads/...`) get the API origin prepended.
String resolveImageUrl(String raw) {
  final v = raw.trim();
  if (v.isEmpty) return '';
  final apiBase = ApiConfig.baseUrl;
  final origin = apiBase.endsWith('/api')
      ? apiBase.substring(0, apiBase.length - 4)
      : apiBase;
  if (v.startsWith('http://localhost') || v.startsWith('http://127.0.0.1')) {
    final slash = v.indexOf('/', 'http://'.length);
    final pathPart = slash >= 0 ? v.substring(slash) : '/';
    return '$origin$pathPart';
  }
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('/')) return '$origin$v';
  return '$origin/$v';
}

/// Turns an avatar string (http URL or base64 `data:` URI) into an
/// ImageProvider, or null when empty/unusable so callers fall back to initials.
ImageProvider? avatarProvider(String src) {
  final s = src.trim();
  if (s.isEmpty) return null;
  if (s.startsWith('data:')) {
    try {
      return MemoryImage(base64Decode(s.split(',').last));
    } catch (_) {
      return null;
    }
  }
  // Uploaded avatars can be stored as relative paths (/uploads/...) in dev or
  // as localhost URLs from an earlier local run — resolve both to an absolute,
  // device-reachable URL before handing the string to NetworkImage.
  final resolved = resolveImageUrl(s);
  if (resolved.startsWith('http')) return NetworkImage(resolved);
  return null;
}
