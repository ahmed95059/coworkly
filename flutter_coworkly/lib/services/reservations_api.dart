import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';

class ReservationsApi {
  ReservationsApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<Map<String, dynamic>> createReservation({
    required String token,
    required String seatId,
    required String date,
    required String startTime,
    required String endTime,
    double? price,
  }) async {
    final uri = Uri.parse('${ApiConfig.baseUrl}/reservations');
    final response = await _client.post(
      uri,
      headers: ApiConfig.headers(token: token),
      body: jsonEncode({
        'seatId': seatId,
        'date': date,
        'startTime': startTime,
        'endTime': endTime,
        if (price != null) 'price': price,
      }),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body) as Map<String, dynamic>;
    }

    var message = 'Request failed (${response.statusCode})';
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        if (decoded['errors'] is List) {
          message = (decoded['errors'] as List).join(', ');
        } else if (decoded['error'] is String) {
          message = decoded['error'] as String;
        }
      }
    } catch (_) {
      // Ignore parse errors and keep the default message.
    }

    throw Exception(message);
  }

  void dispose() {
    _client.close();
  }
}
