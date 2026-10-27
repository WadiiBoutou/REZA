import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import '../config/demo_config.dart';
import 'demo_api_client.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, {this.status});
  @override
  String toString() => message;
}

typedef TokenGetter = Future<String?> Function();
typedef OnUnauthorized = Future<void> Function();

/// Multi-salon scope for [X-Salon-Ids] (Web ApiClient parity).
/// `null` / empty → treat as all salons (`X-Salon-Ids: all`).
class ApiClient {
  ApiClient({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  TokenGetter? tokenGetter;
  OnUnauthorized? onUnauthorized;

  /// `'all'` or concrete salon tenant ids.
  Object _salonFilter = 'all';

  String get _base => ApiConfig.baseUrl;

  void setSalonFilter(Object filter) {
    if (filter == 'all') {
      _salonFilter = 'all';
      return;
    }
    if (filter is List) {
      final ids = filter.map((e) => e.toString()).where((e) => e.isNotEmpty).toList();
      _salonFilter = ids.isEmpty ? 'all' : ids;
      return;
    }
    _salonFilter = 'all';
  }

  Object getSalonFilter() => _salonFilter;

  Future<Map<String, String>> _headers(String path) async {
    final h = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    final token = await tokenGetter?.call();
    if (token != null && token.isNotEmpty) {
      h['Authorization'] = 'Bearer $token';
      if (!path.startsWith('/auth/') && !path.startsWith('/public/')) {
        if (_salonFilter == 'all') {
          h['X-Salon-Ids'] = 'all';
        } else if (_salonFilter is List && (_salonFilter as List).isNotEmpty) {
          h['X-Salon-Ids'] = (_salonFilter as List).join(',');
        }
      }
    }
    return h;
  }

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('GET', path, query: query);
    }
    
    final parsed = Uri.parse('$_base$path');
    final uri = (query == null || query.isEmpty)
        ? parsed
        : parsed.replace(queryParameters: {...parsed.queryParameters, ...query});
    final res = await _client.get(uri, headers: await _headers(path));
    return _decode(res);
  }

  Future<Map<String, dynamic>> post(String path, [Map<String, dynamic>? body]) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('POST', path, body: body);
    }
    
    final res = await _client.post(
      Uri.parse('$_base$path'),
      headers: await _headers(path),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('PUT', path, body: body);
    }
    
    final res = await _client.put(
      Uri.parse('$_base$path'),
      headers: await _headers(path),
      body: jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> patch(String path, [Map<String, dynamic>? body]) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('PATCH', path, body: body);
    }
    
    final res = await _client.patch(
      Uri.parse('$_base$path'),
      headers: await _headers(path),
      body: body == null ? null : jsonEncode(body),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> delete(String path, {Map<String, String>? query}) async {
    // Demo mode: intercept and use mock data
    if (DemoConfig.isDemoMode) {
      return DemoApiClient.request('DELETE', path, query: query);
    }
    
    final uri = Uri.parse('$_base$path').replace(queryParameters: query);
    final res = await _client.delete(uri, headers: await _headers(path));
    return _decode(res);
  }

  Future<Map<String, dynamic>> _decode(http.Response res) async {
    Map<String, dynamic> json = {};
    if (res.body.isNotEmpty) {
      final decoded = jsonDecode(res.body);
      if (decoded is Map<String, dynamic>) {
        json = decoded;
      } else if (decoded is List) {
        json = {'data': decoded};
      }
    }
    if (res.statusCode == 401) {
      await onUnauthorized?.call();
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(
        (json['message'] as String?) ??
            (json['error'] as String?) ??
            'Erreur serveur (${res.statusCode})',
        status: res.statusCode,
      );
    }
    return json;
  }
}

final apiClient = ApiClient();
