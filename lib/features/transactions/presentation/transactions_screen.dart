import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/theme/app_theme.dart';

class TransactionsScreen extends StatelessWidget {
  const TransactionsScreen({super.key});

  Future<List<Map<String, dynamic>>> _getRentals() async {
    final user = Supabase.instance.client.auth.currentUser;
    if (user == null) return [];
    final rows = await Supabase.instance.client
        .from('rentals')
        .select('id, status, start_date, end_date, total_price, items(title)')
        .eq('renter_id', user.id)
        .order('created_at', ascending: false);
    return rows;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Transaksi',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _getRentals(),
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return const Center(child: Text('Gagal memuat transaksi.'));
          }
          final rentals = snapshot.data!;
          if (rentals.isEmpty) {
            return const Center(child: Text('Belum ada transaksi.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: rentals.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final rental = rentals[index];
              final item = rental['items'] as Map<String, dynamic>;
              return _TransactionCard(
                title: item['title'] as String,
                status: rental['status'] as String,
                detail:
                    '${rental['start_date']} sampai ${rental['end_date']} · Rp ${rental['total_price']}',
                color: AppColors.mint,
              );
            },
          );
        },
      ),
    );
  }
}

class _TransactionCard extends StatelessWidget {
  const _TransactionCard({
    required this.title,
    required this.status,
    required this.detail,
    required this.color,
  });
  final String title;
  final String status;
  final String detail;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                status,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 14),
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 6),
            Text(detail, style: const TextStyle(color: AppColors.muted)),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {},
                    child: const Text('Chat Pemilik'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton(
                    onPressed: () {},
                    child: const Text('Lihat Detail'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
