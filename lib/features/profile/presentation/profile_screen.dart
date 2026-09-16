import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'PinjamIn',
          style: TextStyle(
            color: AppColors.primary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                children: [
                  CircleAvatar(radius: 42, child: Icon(Icons.person, size: 42)),
                  SizedBox(height: 12),
                  Text(
                    'Nabila Syahrani',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                  SizedBox(height: 6),
                  Chip(label: Text('Mahasiswa USU · Fasilkom ’22')),
                  Text(
                    '✓ Akun Terverifikasi KTM',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Card(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Padding(
              padding: EdgeInsets.symmetric(vertical: 18),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _Metric('14', 'Barang Disewa'),
                  _Metric('840rb', 'Pendapatan'),
                  _Metric('4.95★', 'Rating'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Pengaturan akun',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          const Card(
            child: Column(
              children: [
                ListTile(
                  leading: Icon(Icons.badge_outlined),
                  title: Text('Verifikasi Identitas & KTM'),
                  subtitle: Text('Terverifikasi ✓'),
                  trailing: Icon(Icons.chevron_right),
                ),
                Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.account_balance_wallet_outlined),
                  title: Text('Metode Pembayaran'),
                  subtitle: Text('BCA Digital •••• 4281'),
                  trailing: Icon(Icons.chevron_right),
                ),
                Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.receipt_long_outlined),
                  title: Text('Riwayat Transaksi'),
                  trailing: Icon(Icons.chevron_right),
                ),
                Divider(height: 1),
                ListTile(
                  leading: Icon(Icons.help_outline),
                  title: Text('Pusat Bantuan'),
                  trailing: Icon(Icons.chevron_right),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.value, this.label);
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: AppColors.primary,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 11),
        ),
      ],
    );
  }
}
