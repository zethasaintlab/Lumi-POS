import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

export type ReceiptData = {
  orderNumber: string
  createdAt: string
  paymentMethod: string
  total: number
  amountPaid: number
  change: number
  items: { name: string; qty: number; price: number }[]
}

const rupiah = (n: number) => 'Rp ' + new Intl.NumberFormat('id-ID').format(n)

// Courier is a built-in @react-pdf font (no registration needed) and fits the
// thermal-printer / monospace aesthetic (design-system signature element).
const styles = StyleSheet.create({
  page: { paddingVertical: 18, paddingHorizontal: 16, fontSize: 9, fontFamily: 'Courier' },
  title: { fontSize: 13, fontFamily: 'Courier-Bold', textAlign: 'center' },
  center: { textAlign: 'center' },
  muted: { color: '#686d6a' },
  hr: { borderBottomWidth: 1, borderColor: '#1c1e1d', borderStyle: 'dashed', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  item: { marginBottom: 4 },
})

export function receiptDocument(d: ReceiptData) {
  return (
    <Document>
      <Page size={[226.77, 800]} style={styles.page}>
        <Text style={styles.title}>LUMI POS</Text>
        <Text style={[styles.center, styles.muted]}>Struk Transaksi</Text>
        <View style={styles.hr} />

        <View style={styles.row}>
          <Text>No. Order</Text>
          <Text>{d.orderNumber}</Text>
        </View>
        <View style={styles.row}>
          <Text>Waktu</Text>
          <Text>{d.createdAt}</Text>
        </View>
        <View style={styles.row}>
          <Text>Metode</Text>
          <Text>{d.paymentMethod}</Text>
        </View>

        <View style={styles.hr} />

        {d.items.map((it, i) => (
          <View key={i} style={styles.item}>
            <Text>{it.name}</Text>
            <View style={styles.row}>
              <Text style={styles.muted}>
                {it.qty} x {rupiah(it.price)}
              </Text>
              <Text>{rupiah(it.qty * it.price)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.hr} />

        <View style={styles.row}>
          <Text>Total</Text>
          <Text>{rupiah(d.total)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Bayar</Text>
          <Text>{rupiah(d.amountPaid)}</Text>
        </View>
        <View style={styles.row}>
          <Text>Kembalian</Text>
          <Text>{rupiah(d.change)}</Text>
        </View>

        <View style={styles.hr} />
        <Text style={[styles.center, styles.muted]}>Terima kasih</Text>
      </Page>
    </Document>
  )
}
