import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class TransactionsScreen extends StatelessWidget {
  const TransactionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Transaksi',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'Disewa', label: Text('Disewa')),
              ButtonSegment(value: 'Dipinjamkan', label: Text('Dipinjamkan')),
              ButtonSegment(value: 'Selesai', label: Text('Selesai')),
            ],
            selected: {'Disewa'},
          ),
          const SizedBox(height: 24),
          const Text(
            'Sedang berlangsung',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          const _TransactionCard(
            title: 'Sony Alpha A6400',
            status: 'Sedang disewa',
            detail: '18–20 Sep · Kembalikan sebelum 18.00',
            color: AppColors.mint,
          ),
          const SizedBox(height: 24),
          const Text(
            'Menunggu tindakan',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          const _TransactionCard(
            title: 'Jas Lab Kimia + Goggles',
            status: 'Menunggu persetujuan',
            detail: '22 Sep · 1 hari',
            color: Color(0xFFFFE8B5),
          ),
        ],
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
